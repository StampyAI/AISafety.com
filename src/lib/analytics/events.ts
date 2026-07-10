// First-party analytics event store (server-side only).
//
// Two backends, chosen automatically at runtime:
//   • Production: Upstash Redis — the same instance the chatbot rate-limiter
//     already uses. Events are stored in one list per calendar month
//     (aisafety:analytics:events:2026-07, …), newest first, with a sorted set
//     indexing which months exist. Nothing is ever deleted: a dashboard query
//     reads only the months its date range touches, so reads stay fast and
//     bounded no matter how much history accumulates. (The store originally
//     kept a single list capped at 5,000 events, which silently deleted
//     everything older than ~10 days — including all of 20–30 June 2026, the
//     first stretch after launch. The migrate endpoint copied that list's
//     survivors into their month lists on 10 July 2026.)
//   • Local dev (no Redis env vars set): an append-only NDJSON file under
//     .analytics-dev/ so the whole loop works on a laptop without touching
//     production data.
//
// Aggregation happens per-query in JS over the raw events: this keeps storage
// simple, makes the dashboard fully date-range aware (every event carries a
// timestamp), and means dev and prod compute identically. If a single month
// ever outgrows a JS aggregation pass we'd add daily rollups on top.

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface AnalyticsEvent {
  /** Event kind, e.g. 'listing_click'. Must be in ALLOWED_EVENT_TYPES. */
  type: string
  /** Resource page the event came from, e.g. 'Funding'. */
  page?: string
  /** Airtable record id of the listing, when known — the stable join key back
   *  to the source record (names and urls can change; the id doesn't). */
  listingId?: string
  /** Human-readable label for dashboards, e.g. the listing name. */
  label?: string
  /** The slot the listing occupied when it was clicked — 'F1'/'F2' for the two
   *  featured cards, otherwise its number in the list ('1', '2', …). Stamped at
   *  click time so it survives later reordering; absent on pre-feature clicks. */
  position?: string
  /** Where on the page the click came from. Only set to 'map' on the two pages
   *  with a map (Map, Communities) when the click is on the map itself; every
   *  other click (cards, featured cards) is left unset and treated as a card. */
  source?: string
  /** Destination / relevant URL. */
  url?: string
  /** Referrer path, if available. */
  ref?: string
  /** Anonymous per-browser id, for unique-user counts. */
  vid?: string
  /** ISO timestamp, set server-side — never trust the client clock. */
  ts: string
}

/** Event kinds we accept. Add a kind here when wiring up a new tracked action;
 *  the public endpoint rejects anything not in this set, which bounds what an
 *  abusive caller can write. */
export const ALLOWED_EVENT_TYPES = new Set<string>([
  'listing_click',
  'chatbot_open',
  'chatbot_message',
  'chatbot_click',
])

// ─── Redis backend ───────────────────────────────────────────────────────────

// The Vercel-Upstash Marketplace integration provisions KV_REST_API_URL /
// KV_REST_API_TOKEN; also accept the upstream UPSTASH_REDIS_REST_* names. Same
// fallback chain the rate-limiter uses, so we hit the same database.
const restUrl =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const restToken =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

const store =
  restUrl && restToken ? new Redis({ url: restUrl, token: restToken }) : null

const trackLimiter = store
  ? new Ratelimit({
      redis: store,
      // Generous for real clicking; bounds scripted abuse. ~40 events / 10s / IP.
      limiter: Ratelimit.slidingWindow(40, '10 s'),
      analytics: false,
      prefix: 'aisafety:analytics:rl',
    })
  : null

// One list of raw events per calendar month (newest first), plus a sorted set
// naming the months that exist so reads never have to scan the keyspace.
const MONTH_KEY_PREFIX = 'aisafety:analytics:events:' // + 'YYYY-MM'
const MONTHS_KEY = 'aisafety:analytics:months'
// The original single-list store, retired 10 Jul 2026. Its contents were copied
// into the month lists by migrateLegacyEvents(); the key itself is left in
// place so a rolled-back deployment still finds its data.
const LEGACY_EVENTS_KEY = 'aisafety:analytics:events'
const MIGRATED_KEY = 'aisafety:analytics:legacy-migrated'
// Backstop only — never reached by real traffic (~15k events/month, ~300 bytes
// each, as of July 2026; this is ~3× headroom). It bounds what a scripted
// abuser who stays under the per-IP rate limit can grow a month list to: at
// the cap a month is ~15 MB of organic events, or ~90 MB if an attacker maxes
// every length-capped field — either way comfortably inside the shared
// free-tier database's 256 MB, which the chatbot rate limiter also lives in.
// recordEvent warns in the logs whenever the cap actually trims, and the
// dashboard shows a warning banner from MONTH_CAP_WARN_RATIO up — so organic
// growth approaching the cap is visible well before data quietly disappears.
const MONTH_CAP = 50_000
// Share of MONTH_CAP at which the dashboard starts warning: early enough to
// raise the cap (one constant, redeploy) before anything is actually trimmed.
const MONTH_CAP_WARN_RATIO = 0.75
// Month lists are read in slices of this many events, each slice as its OWN
// REST request (a pipeline wouldn't help — the client sends a pipeline as one
// HTTP call whose single response would still carry everything), so no
// response can outgrow Upstash's response-size limits, however big a month
// gets. ~300-byte events make a full slice ~1.5 MB.
const READ_CHUNK = 5000

/** 'YYYY-MM' (UTC) an event belongs to, from its server-stamped timestamp. */
function monthOf(ts: string): string | null {
  return /^\d{4}-\d{2}/.test(ts) ? ts.slice(0, 7) : null
}

/** Numeric sort score for a 'YYYY-MM' month, e.g. '2026-07' → 202607. */
function monthScore(month: string): number {
  return Number(month.replace('-', ''))
}

/** Epoch-ms bounds [start, end) of a 'YYYY-MM' month, in UTC. */
function monthBounds(month: string): { startMs: number; endMs: number } {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return {
    startMs: Date.UTC(y, m - 1, 1),
    endMs: Date.UTC(y, m, 1), // Date.UTC rolls month 12 into January
  }
}

/** The stored months (ascending) whose lists could hold events in the range.
 *  Purely a read optimisation — the per-event date filter in aggregate() is
 *  what actually enforces the bounds. */
function monthsInRange(months: string[], range: DateRange): string[] {
  return months.filter(m => {
    const b = monthBounds(m)
    if (range.startMs != null && b.endMs <= range.startMs) return false
    if (range.endMs != null && b.startMs > range.endMs) return false
    return true
  })
}

// ─── Local-file backend (dev only) ───────────────────────────────────────────

const DEV_DIR = path.join(process.cwd(), '.analytics-dev')
const DEV_FILE = path.join(DEV_DIR, 'events.ndjson')

async function writeDevEvent(e: AnalyticsEvent): Promise<void> {
  await fs.mkdir(DEV_DIR, { recursive: true })
  await fs.appendFile(DEV_FILE, JSON.stringify(e) + '\n', 'utf8')
}

/** Dev events, newest first (file is appended oldest-first, so reverse). */
async function readDevEvents(): Promise<AnalyticsEvent[]> {
  let raw: string
  try {
    raw = await fs.readFile(DEV_FILE, 'utf8')
  } catch {
    return [] // file not created yet — no events recorded so far
  }
  const out: AnalyticsEvent[] = []
  for (const line of raw.split('\n')) {
    if (!line) continue
    try {
      out.push(JSON.parse(line) as AnalyticsEvent)
    } catch {
      console.warn('[analytics] skipping malformed dev-log line')
    }
  }
  return out.reverse()
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Whether to accept another event from this IP right now. Fails open (returns
 *  true) when Redis is unavailable, so dev and a Redis outage don't drop data. */
export async function allowTrack(ip: string): Promise<boolean> {
  if (!trackLimiter) return true
  try {
    const { success } = await trackLimiter.limit(ip)
    return success
  } catch (err) {
    console.warn(
      `[analytics] rate-limit check failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return true
  }
}

/** Record one event. Never throws to the caller — a failed analytics write must
 *  not break the user's request (it is fired via after() from the route). */
export async function recordEvent(event: AnalyticsEvent): Promise<void> {
  try {
    if (store) {
      const month = monthOf(event.ts)
      if (!month) {
        console.warn(
          `[analytics] dropping event with bad timestamp: ${event.ts}`
        )
        return
      }
      const p = store.pipeline()
      p.lpush(MONTH_KEY_PREFIX + month, event) // upstash serializes to JSON
      p.zadd(MONTHS_KEY, { score: monthScore(month), member: month })
      const [len] = (await p.exec()) as [number, unknown]
      // Abuse backstop, applied only when actually over the cap. Trimming the
      // tail on every write would also destabilise readMonths' tail-anchored
      // slices, so the common case must stay pure-LPUSH. Never silent: real
      // data loss (an attack, or organic growth outgrowing the cap) is logged.
      if (len > MONTH_CAP) {
        console.warn(
          `[analytics] month ${month} is over its ${MONTH_CAP}-event backstop cap (${len}) — trimming oldest events. If this is organic traffic, raise MONTH_CAP.`
        )
        await store.ltrim(MONTH_KEY_PREFIX + month, 0, MONTH_CAP - 1)
      }
      return
    }
    // No Redis configured (local dev) — fall back to the on-disk log.
    await writeDevEvent(event)
  } catch (err) {
    console.warn(
      `[analytics] event write failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export interface Counted {
  name: string
  count: number
}

export interface ListingRow extends Counted {
  /** Lowest–highest slot this listing was clicked at during the period (e.g.
   *  'F1', '2', '4–8'), from positions stamped at click time. Undefined when
   *  none of its clicks in range carry a recorded position. */
  position?: string
  /** A representative destination url (most recent click) — lets the dashboard
   *  show a favicon for pages whose listings have no Airtable logo. */
  url?: string
}

export interface OverallListingRow extends Counted {
  /** The resource page this listing belongs to (e.g. 'Funding'), so the
   *  site-wide leaderboard can show which page each top listing came from. */
  page?: string
  /** A representative destination url (most recent click), for the favicon. */
  url?: string
}

export interface DateRange {
  /** Inclusive lower bound in epoch ms, or null for no lower bound. */
  startMs: number | null
  /** Inclusive upper bound in epoch ms, or null for no upper bound. */
  endMs: number | null
}

export interface ChatbotFunnel {
  /** Unique users who opened the chatbot. */
  opened: number
  /** Unique users who sent it a message. */
  typed: number
  /** Unique users who clicked a result it surfaced. */
  clicked: number
}

export interface DashboardData {
  /** Which backend served this data — surfaced in the UI so it's obvious in dev. */
  source: 'redis' | 'local-file' | 'none'
  /** True if the store couldn't be read (e.g. Redis outage); UI shows a notice. */
  error?: boolean
  /** Total events within the selected range. */
  totalEvents: number
  byPage: Counted[]
  /** Which resource page the per-listing panels below reflect. Null only when
   *  no page has any clicks in range. */
  selectedPage: string | null
  /** Top listings for `selectedPage`, with each one's slot range this period. */
  topListings: ListingRow[]
  /** `selectedPage`'s clicks bucketed by the slot they happened in, ordered F1,
   *  F2, 1, 2, 3… — answers "do higher slots draw more clicks" for that page. */
  byPosition: Counted[]
  /** Site-wide most-clicked listings, across every page (not scoped to
   *  `selectedPage`). Each row carries the page it came from. */
  topListingsOverall: OverallListingRow[]
  /** Every click across every page bucketed by the slot it happened in, ordered
   *  F1, F2, 1, 2, 3… — the site-wide version of `byPosition`. */
  byPositionOverall: Counted[]
  /** For pages with a map (Map, Communities): the selected page's clicks split
   *  into 'Map' vs 'Cards'. Empty for pages without a map. Always the full split,
   *  even when one source is selected, so the user can switch between them. */
  bySource: Counted[]
  /** The source the per-listing panels are filtered to ('map' | 'cards' |
   *  'untracked'), or null for all sources. Only ever set on map pages. */
  selectedSource: string | null
  funnel: ChatbotFunnel
  recent: AnalyticsEvent[]
  /** Timestamp of the oldest event in the WHOLE store (not just the selected
   *  range) — lets the dashboard say how far back its data actually goes.
   *  Undefined when the store is empty or the oldest event can't be read. */
  oldestTs?: string
  /** Months whose event count has reached MONTH_CAP_WARN_RATIO of the backstop
   *  cap — the dashboard shows a warning so the cap can be raised before it
   *  trims anything. Checked across the whole store, not just the selected
   *  range. Normally empty. */
  nearCap: { month: string; count: number; cap: number }[]
}

const EMPTY: Omit<DashboardData, 'source'> = {
  totalEvents: 0,
  byPage: [],
  selectedPage: null,
  topListings: [],
  byPosition: [],
  topListingsOverall: [],
  byPositionOverall: [],
  bySource: [],
  selectedSource: null,
  funnel: { opened: 0, typed: 0, clicked: 0 },
  recent: [],
  nearCap: [],
}

/** Source filters offered on map pages. 'untracked' = neither map nor cards. */
const SOURCE_FILTERS = new Set(['map', 'cards', 'untracked'])

/** Resource pages that have a map above their card list, so a click can come
 *  from either surface. These are the only pages that get a source breakdown. */
const MAP_PAGES = new Set(['Map', 'Communities'])

/** What a listing click is counted under. Prefer the human label; fall back to
 *  id/url so nothing is silently dropped. */
function listingMember(e: AnalyticsEvent): string {
  return e.label || e.listingId || e.url || '(unknown)'
}

function tally(items: string[]): Counted[] {
  const m = new Map<string, number>()
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/** Sort key putting the featured slots above the numbered list: F1, F2, 1, 2…
 *  Unparseable labels sort last so a stray value never crashes the ordering. */
function positionSortKey(p: string): number {
  if (p === 'F1') return -2
  if (p === 'F2') return -1
  const n = Number(p)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

/** Compact "lowest–highest slot" label for a listing's recorded positions, e.g.
 *  ['3','5','4'] → '3–5', ['F1','F1'] → 'F1'. Undefined for an empty set. */
function positionRange(positions: string[]): string | undefined {
  if (positions.length === 0) return undefined
  const sorted = [...positions].sort(
    (a, b) => positionSortKey(a) - positionSortKey(b)
  )
  const lo = sorted[0]
  const hi = sorted[sorted.length - 1]
  return lo === hi ? lo : `${lo}–${hi}`
}

/** Like tally(), but ordered by slot (F1, F2, 1, 2…) rather than by count, so
 *  the by-position table reads as a ladder from top slot to bottom. */
function tallyPositions(positions: string[]): Counted[] {
  const m = new Map<string, number>()
  for (const p of positions) m.set(p, (m.get(p) ?? 0) + 1)
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => positionSortKey(a.name) - positionSortKey(b.name))
}

/** Collapse repeat clicks so a visitor counts once per listing per day: keep
 *  only the most recent click per (visitor, day, page, listing). The day uses
 *  Bryce's timezone (UTC-5), matching the date-range bounds. Clicks with no id
 *  (e.g. private browsing, where we can't tell visitors apart) are each kept.
 *  Expects a newest-first list, so the first time a key is seen is the most
 *  recent click. */
function uniqueClicks(clicks: AnalyticsEvent[]): AnalyticsEvent[] {
  const seen = new Set<string>()
  const out: AnalyticsEvent[] = []
  for (const e of clicks) {
    if (!e.vid) {
      out.push(e)
      continue
    }
    const t = Date.parse(e.ts)
    const day = Number.isNaN(t)
      ? ''
      : new Date(t - 5 * 3_600_000).toISOString().slice(0, 10)
    const key = `${e.vid} ${day} ${e.page ?? ''} ${listingMember(e)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

/** Aggregate a newest-first event list into the dashboard view, filtered to the
 *  given date range. `selectedPageReq` chooses which resource page the
 *  per-listing panels reflect; it falls back to Funding, then the busiest page.
 *  `unique` (default) counts each visitor once per listing per day; pass false
 *  to count every click. */
function aggregate(
  all: AnalyticsEvent[],
  { startMs, endMs }: DateRange,
  selectedPageReq?: string,
  unique = true,
  sourceReq?: string
): Omit<DashboardData, 'source' | 'error' | 'oldestTs' | 'nearCap'> {
  const inRange = all.filter(e => {
    const t = Date.parse(e.ts)
    if (Number.isNaN(t)) return false
    if (startMs != null && t < startMs) return false
    if (endMs != null && t > endMs) return false
    return true
  })
  // Every click table below derives from this set. In unique mode it's deduped
  // to one click per visitor per listing per day, so repeat clicks don't inflate
  // the counts; in total mode every click is counted.
  const pageHits = inRange.filter(e => e.page)
  const clicks = unique ? uniqueClicks(pageHits) : pageHits
  const usersOf = (type: string) =>
    uniqueUsers(inRange.filter(e => e.type === type))

  const byPage = tally(clicks.map(e => e.page as string))
  const pageNames = byPage.map(p => p.name)
  // The page the listing panels drill into. An explicit request always wins —
  // even with no clicks in range — so selecting a quiet page's tab shows that
  // page (empty), not a fallback. With no request, default to Funding (Bryce's
  // main interest), then the busiest page.
  const selectedPage = selectedPageReq
    ? selectedPageReq
    : pageNames.includes('Funding')
      ? 'Funding'
      : (pageNames[0] ?? null)

  // On a map page the panels can be filtered to one click source. The split
  // itself (bySource, below) is always computed from every click on the page so
  // the user can switch sources; only the per-listing panels narrow.
  const isMapPage = selectedPage != null && MAP_PAGES.has(selectedPage)
  const selectedSource =
    isMapPage && sourceReq && SOURCE_FILTERS.has(sourceReq) ? sourceReq : null
  const matchesSource = (e: AnalyticsEvent): boolean => {
    if (selectedSource === 'map') return e.source === 'map'
    if (selectedSource === 'cards') return e.source === 'cards'
    if (selectedSource === 'untracked')
      return e.source !== 'map' && e.source !== 'cards'
    return true // no filter
  }

  // For the selected page: total clicks per listing, the range of slots each was
  // clicked at (from positions stamped at click time, so it's period-accurate
  // even as the page is reordered), and a representative url for its favicon.
  const pageClicksAll = clicks.filter(e => e.page === selectedPage)
  const pageClicks = pageClicksAll.filter(matchesSource)
  const perListing = new Map<
    string,
    { count: number; positions: string[]; url?: string }
  >()
  for (const e of pageClicks) {
    // pageClicks is newest-first, so the first url we see is the most recent.
    const k = listingMember(e)
    const g = perListing.get(k) ?? { count: 0, positions: [], url: e.url }
    g.count += 1
    if (e.position) g.positions.push(e.position)
    if (!g.url && e.url) g.url = e.url
    perListing.set(k, g)
  }
  // Every listing for the page, ranked by clicks — the dashboard shows the first
  // 50 and lets the user reveal more, so we return the full list rather than a
  // fixed top-N here.
  const topListings: ListingRow[] = [...perListing.entries()]
    .map(([name, g]) => ({
      name,
      count: g.count,
      position: positionRange(g.positions),
      url: g.url,
    }))
    .sort((a, b) => b.count - a.count)

  // Site-wide leaderboards, independent of the selected page: the most-clicked
  // listings and the busiest slots across every page. Keyed by page+listing so
  // the same name on two pages stays two rows (each keeps its own page pill).
  const perOverall = new Map<
    string,
    { name: string; page?: string; count: number; url?: string }
  >()
  for (const e of clicks) {
    const name = listingMember(e)
    const key = `${e.page ?? ''} ${name}`
    // clicks is newest-first, so the first url seen for a listing is the latest.
    const g = perOverall.get(key) ?? {
      name,
      page: e.page,
      count: 0,
      url: e.url,
    }
    g.count += 1
    if (!g.url && e.url) g.url = e.url
    perOverall.set(key, g)
  }
  const topListingsOverall: OverallListingRow[] = [...perOverall.values()]
    .map(g => ({ name: g.name, page: g.page, count: g.count, url: g.url }))
    .sort((a, b) => b.count - a.count)
  const byPositionOverall = tallyPositions(
    clicks.map(e => e.position).filter((p): p is string => p != null)
  )

  // Source split, only for pages with a map. Clicks are explicitly tagged 'map'
  // or 'cards' at click time; anything untagged (logged before source tracking,
  // or a surface we don't tag) is its own 'Untracked' bucket rather than being
  // miscounted as a card. Honours the unique/total mode (same pageClicks). Only
  // non-empty buckets are shown.
  let bySource: Counted[] = []
  if (isMapPage) {
    let map = 0
    let cards = 0
    let untracked = 0
    for (const e of pageClicksAll) {
      if (e.source === 'map') map += 1
      else if (e.source === 'cards') cards += 1
      else untracked += 1
    }
    bySource = [
      { name: 'Map', count: map },
      { name: 'Cards', count: cards },
      { name: 'Untracked', count: untracked },
    ].filter(r => r.count > 0)
  }

  return {
    totalEvents: inRange.length,
    byPage,
    selectedPage,
    topListings,
    byPosition: tallyPositions(
      pageClicks.map(e => e.position).filter((p): p is string => p != null)
    ),
    topListingsOverall,
    byPositionOverall,
    bySource,
    selectedSource,
    funnel: {
      opened: usersOf('chatbot_open'),
      typed: usersOf('chatbot_message'),
      clicked: usersOf('chatbot_click'),
    },
    recent: inRange.slice(0, 50), // already newest-first
  }
}

/** Distinct users in a set of events: distinct vids, plus each vid-less event
 *  counted once (can't dedup what we can't identify). */
function uniqueUsers(events: AnalyticsEvent[]): number {
  const seen = new Set<string>()
  let anon = 0
  for (const e of events) {
    if (e.vid) seen.add(e.vid)
    else anon++
  }
  return seen.size + anon
}

/** Every event in the given months, globally newest-first. Each month list is
 *  read in READ_CHUNK slices addressed FROM THE TAIL: normal writes only ever
 *  prepend at the head, so tail-relative indices stay stable and a read can't
 *  double-count or skip events mid-way. Events arriving after the length
 *  snapshot simply aren't part of this read — the next refresh has them. (The
 *  one exception to head-only writes is the backstop trim on a month over
 *  MONTH_CAP, which eats the tail; a trim landing mid-read can shift a few
 *  seam events between slices. That's transient, per-read, abuse-only noise —
 *  the stored data stays correct.)
 *
 *  Each slice is awaited as its OWN request, deliberately not pipelined: the
 *  client sends a pipeline as a single HTTP call, whose one response would
 *  carry every slice at once — recreating exactly the oversized response the
 *  slicing exists to prevent. Sequential round trips are fine here: at organic
 *  volume a dashboard range is a handful of slices. */
async function readMonths(
  db: Redis,
  monthsNewestFirst: { month: string; len: number }[]
): Promise<AnalyticsEvent[]> {
  // Newest-first overall: months newest → oldest, and within a month the head
  // (newest) slice first. In tail-relative terms the head slice is the DEEPEST
  // tail offset, so iterate offsets downward.
  const out: AnalyticsEvent[] = []
  for (const { month, len } of monthsNewestFirst) {
    const key = MONTH_KEY_PREFIX + month
    const sliceCount = Math.ceil(len / READ_CHUNK)
    for (let s = sliceCount - 1; s >= 0; s--) {
      const fromTail = s * READ_CHUNK // events between this offset and the tail
      out.push(
        ...(await db.lrange<AnalyticsEvent>(
          key,
          Math.max(-len, -(fromTail + READ_CHUNK)),
          -(fromTail + 1)
        ))
      )
    }
  }
  return out
}

/** The months at or past the warn share of the backstop cap, given every
 *  stored month's event count. Shared by both backends so the dashboard's
 *  early warning behaves identically in dev and prod. */
function nearCapMonths(
  counts: { month: string; count: number }[]
): DashboardData['nearCap'] {
  return counts
    .filter(c => c.count >= MONTH_CAP * MONTH_CAP_WARN_RATIO)
    .map(c => ({ ...c, cap: MONTH_CAP }))
}

export async function readDashboard(
  range: DateRange,
  page?: string,
  unique = true,
  sourceFilter?: string
): Promise<DashboardData> {
  if (store) {
    try {
      // All stored months, oldest first. Every month's length is fetched (a
      // pipeline of integers — cheap) so the near-cap warning covers the whole
      // store; only the months the range touches have their events read. The
      // oldest month also tells us how far back the data goes.
      const months = (await store.zrange(MONTHS_KEY, 0, -1)) as string[]
      let lens: number[] = []
      if (months.length > 0) {
        const lenPipe = store.pipeline()
        for (const m of months) lenPipe.llen(MONTH_KEY_PREFIX + m)
        lens = (await lenPipe.exec()) as number[]
      }
      const byMonth = months.map((month, i) => ({ month, len: lens[i] }))
      const wanted = monthsInRange(months, range)
        .map(m => byMonth.find(b => b.month === m)!)
        .reverse() // newest first
      const [all, oldestEvent] = await Promise.all([
        readMonths(store, wanted),
        months.length > 0
          ? (store.lindex(
              MONTH_KEY_PREFIX + months[0],
              -1
            ) as Promise<AnalyticsEvent | null>)
          : null,
      ])
      return {
        source: 'redis',
        oldestTs: oldestEvent?.ts,
        nearCap: nearCapMonths(
          byMonth.map(b => ({ month: b.month, count: b.len }))
        ),
        ...aggregate(all, range, page, unique, sourceFilter),
      }
    } catch (err) {
      // Degrade gracefully — a Redis blip must not 500 the dashboard.
      console.warn(
        `[analytics] dashboard read failed: ${err instanceof Error ? err.message : String(err)}`
      )
      return { source: 'redis', error: true, ...EMPTY }
    }
  }

  const all = await readDevEvents()
  if (all.length === 0) return { source: 'none', ...EMPTY }
  const devMonthCounts = new Map<string, number>()
  for (const e of all) {
    const month = monthOf(e.ts)
    if (month) devMonthCounts.set(month, (devMonthCounts.get(month) ?? 0) + 1)
  }
  return {
    source: 'local-file',
    oldestTs: all[all.length - 1]?.ts, // newest-first, so the oldest is last
    nearCap: nearCapMonths(
      [...devMonthCounts.entries()].map(([month, count]) => ({ month, count }))
    ),
    ...aggregate(all, range, page, unique, sourceFilter),
  }
}

export interface MigrationResult {
  /** True when a previous run already did the copy, so this call was a no-op. */
  alreadyMigrated: boolean
  /** Events copied out of the legacy list, per month. Empty on a no-op. */
  copied: Record<string, number>
}

/** One-time copy of the retired single-list store into the per-month lists.
 *  COPIES rather than moves: the legacy list stays untouched so a rolled-back
 *  deployment (which only knows the old key) still sees its data, while new
 *  code never reads it — each event lives in exactly one place per code
 *  version, so nothing double-counts.
 *
 *  A marker key claimed with SET NX makes a second call a no-op — two copies
 *  would double every pre-migration event. The marker is claimed BEFORE the
 *  copy and then updated with per-month progress after every copied batch, so
 *  a mid-copy crash leaves an exact record of what landed. Recovery from such
 *  a crash (never needed if the one POST succeeds): read the marker's copied
 *  counts, then for each listed month LTRIM that many elements OFF THE TAIL of
 *  its month list (copied legacy events always sit at the tail, and head
 *  growth from live traffic doesn't disturb a trim expressed as "keep the
 *  first llen − copied"), delete the marker, and POST again. Do NOT delete
 *  whole month lists: they also hold every event recorded since the deploy,
 *  which exists nowhere else.
 *
 *  Run it a minute or so AFTER the deploy settles: an old-code instance
 *  draining its last requests can still append to the legacy list, and an
 *  event landing there after this function has read the list would be missed
 *  (visible in old dashboards, absent from new ones — recover as above, then
 *  re-run). */
export async function migrateLegacyEvents(): Promise<MigrationResult> {
  if (!store) {
    throw new Error(
      'migrateLegacyEvents needs the Redis backend; the dev file store has no legacy list'
    )
  }
  const claimed = await store.set(
    MIGRATED_KEY,
    { startedAt: new Date().toISOString(), copied: {} },
    { nx: true }
  )
  if (claimed !== 'OK') return { alreadyMigrated: true, copied: {} }

  // The legacy list is bounded (it was capped at 5,000), but read it in chunks
  // anyway — same response-size caution as readMonths.
  const len = await store.llen(LEGACY_EVENTS_KEY)
  const events: AnalyticsEvent[] = []
  for (let start = 0; start < len; start += READ_CHUNK) {
    events.push(
      ...(await store.lrange<AnalyticsEvent>(
        LEGACY_EVENTS_KEY,
        start,
        start + READ_CHUNK - 1
      ))
    )
  }

  // Group by month, keeping each group newest-first (the list already is).
  const byMonth = new Map<string, AnalyticsEvent[]>()
  for (const e of events) {
    const month = monthOf(e.ts)
    if (!month) {
      console.warn(`[analytics] migration skipping event with bad ts: ${e.ts}`)
      continue
    }
    const group = byMonth.get(month) ?? []
    group.push(e)
    byMonth.set(month, group)
  }

  // Legacy events are all older than anything the new code has written (up to
  // a few seconds of rolling-deploy overlap, which only bends ordering at the
  // seam, never counts), so they belong at the TAIL of their month lists:
  // rpush in newest-first order keeps each list newest-first overall. Batches
  // are sent as separate sequential requests (not one pipeline, which would
  // still be a single oversized REST call) so no request can outgrow Upstash's
  // request-size limit, and the marker is updated after every batch so a crash
  // leaves an exact recovery record (see the docstring).
  const copied: Record<string, number> = {}
  const startedAt = new Date().toISOString()
  for (const [month, group] of byMonth) {
    for (let start = 0; start < group.length; start += 500) {
      await store.rpush(
        MONTH_KEY_PREFIX + month,
        ...group.slice(start, start + 500)
      )
      copied[month] = Math.min(start + 500, group.length)
      await store.set(MIGRATED_KEY, { startedAt, copied })
    }
    await store.zadd(MONTHS_KEY, {
      score: monthScore(month),
      member: month,
    })
  }
  await store.set(MIGRATED_KEY, {
    doneAt: new Date().toISOString(),
    copied,
  })
  return { alreadyMigrated: false, copied }
}
