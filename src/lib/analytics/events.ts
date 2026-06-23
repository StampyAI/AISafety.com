// First-party analytics event store (server-side only).
//
// Two backends, chosen automatically at runtime:
//   • Production: Upstash Redis — the same instance the chatbot rate-limiter
//     already uses. Events are appended to one capped list.
//   • Local dev (no Redis env vars set): an append-only NDJSON file under
//     .analytics-dev/ so the whole loop works on a laptop without touching
//     production data.
//
// Aggregation happens per-query in JS over the raw events: this keeps storage
// dead simple (one bounded list), makes the dashboard fully date-range aware
// (every event carries a timestamp), and means dev and prod compute identically.
// At the site's scale the event count is small; if it ever outgrows a single
// capped list we'd move to per-day buckets or a real database.

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

const EVENTS_KEY = 'aisafety:analytics:events' // capped list of raw events, newest first
const MAX_EVENTS = 5000 // keep the raw log bounded on the Upstash free tier

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
      const p = store.pipeline()
      p.lpush(EVENTS_KEY, event) // upstash serializes the object to JSON
      p.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1)
      await p.exec()
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
  /** For pages with a map (Map, Communities): the selected page's clicks split
   *  into 'Map' vs 'Cards'. Empty for pages without a map. */
  bySource: Counted[]
  funnel: ChatbotFunnel
  recent: AnalyticsEvent[]
}

const EMPTY: Omit<DashboardData, 'source'> = {
  totalEvents: 0,
  byPage: [],
  selectedPage: null,
  topListings: [],
  byPosition: [],
  bySource: [],
  funnel: { opened: 0, typed: 0, clicked: 0 },
  recent: [],
}

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
  unique = true
): Omit<DashboardData, 'source' | 'error'> {
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
  // The page the listing panels drill into: the requested one if it has data,
  // else Funding (Bryce's main interest), else the busiest page.
  const selectedPage =
    selectedPageReq && pageNames.includes(selectedPageReq)
      ? selectedPageReq
      : pageNames.includes('Funding')
        ? 'Funding'
        : (pageNames[0] ?? null)

  // For the selected page: total clicks per listing, the range of slots each was
  // clicked at (from positions stamped at click time, so it's period-accurate
  // even as the page is reordered), and a representative url for its favicon.
  const pageClicks = clicks.filter(e => e.page === selectedPage)
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
  const topListings: ListingRow[] = [...perListing.entries()]
    .map(([name, g]) => ({
      name,
      count: g.count,
      position: positionRange(g.positions),
      url: g.url,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Source split, only for pages with a map. Clicks are explicitly tagged 'map'
  // or 'cards' at click time; anything untagged (logged before source tracking,
  // or a surface we don't tag) is its own 'Untracked' bucket rather than being
  // miscounted as a card. Honours the unique/total mode (same pageClicks). Only
  // non-empty buckets are shown.
  let bySource: Counted[] = []
  if (selectedPage && MAP_PAGES.has(selectedPage)) {
    let map = 0
    let cards = 0
    let untracked = 0
    for (const e of pageClicks) {
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
    bySource,
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

export async function readDashboard(
  range: DateRange,
  page?: string,
  unique = true
): Promise<DashboardData> {
  if (store) {
    try {
      // Newest-first (lpush prepends); up to MAX_EVENTS.
      const all = await store.lrange<AnalyticsEvent>(EVENTS_KEY, 0, -1)
      return { source: 'redis', ...aggregate(all, range, page, unique) }
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
  return { source: 'local-file', ...aggregate(all, range, page, unique) }
}
