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
   *  other click (cards, featured cards) is left unset and treated as a card.
   *  Search events reuse it: on search_open it's how the modal was opened
   *  ('button' | 'cmd-k' | 'slash'); on search_query, the active type filter;
   *  on search_click, the clicked result's type ('job', 'funder', …). */
  source?: string
  /** The map-area dimension — the listing's first category, stamped on
   *  Map-page clicks and hovers so the dashboard can slice the map by area. */
  area?: string
  /** Site-search events: the query text as typed — the subject of a
   *  search_query, and on a search_click the query that produced the result. */
  query?: string
  /** search_query only: how many results the query returned. 0 means the
   *  visitor searched for something the site has nothing for. */
  results?: number
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
  'page_view',
  'listing_click',
  // A visitor resting on a map listing (Map, Communities): a 500 ms cursor
  // dwell on desktop, or the tap that opens the tooltip on mobile.
  'listing_hover',
  // A visitor turning a filter value on (sidebar checkbox or dropdown option).
  // `source` is the filter group's title, `label` the value picked.
  'filter_apply',
  'chatbot_open',
  'chatbot_message',
  'chatbot_click',
  // The privacy page's analytics switch: the opt-out is the browser's last
  // recorded event, the opt-in its first after coming back.
  'analytics_optout',
  'analytics_optin',
  // Site search: opening the modal, a settled query, and a result click.
  'search_open',
  'search_query',
  'search_click',
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
// Backstop only — never reached by real traffic. Clicks and chatbot events ran
// ~15k/month as of July 2026; page-view tracking (added 15 July 2026) is
// estimated to lift organic volume to ~50–100k/month, so this is ~1.5–3×
// headroom. It bounds what a scripted abuser who stays under the per-IP rate
// limit can grow a month list to: at the cap a month is ~45 MB of organic
// events, inside the shared free-tier database's 256 MB (which the chatbot
// rate limiter also lives in) — but if months ever actually run near the cap,
// that database needs a paid plan or per-day rollups, not just a bigger cap.
// recordEvent warns in the logs whenever the cap actually trims, and the
// dashboard shows a warning banner from MONTH_CAP_WARN_RATIO up — so organic
// growth approaching the cap is visible well before data quietly disappears.
const MONTH_CAP = 150_000
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
  /** Airtable record id, from the most recent event in range that carried one
   *  — the stable join key back to the source record. */
  listingId?: string
  /** The listing's first category (the map-area dimension), from the most
   *  recent event in range that carried one. Map-page rows only. */
  area?: string
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

/** A clicked-out destination (from chatbot replies or search results). `name`
 *  is the link's visible text when the click carried one, otherwise the raw
 *  url (the dashboard prettifies it). */
export interface ClickDestination extends Counted {
  /** Destination url — for the favicon and link in the dashboard table. */
  url?: string
  /** Search rows only: the clicked result's search type ('job', 'funder', …),
   *  from the most recent click that recorded one — so the dashboard can show
   *  the resource page the result belongs to. Absent on clicks from before
   *  the type was tracked (the dashboard falls back to matching the url
   *  against the live search index). */
  resultType?: string
}

export interface ChatbotPanelData {
  /** Opens bucketed by the page they happened on ('/funding', '/map', …).
   *  Older opens carry no explicit page, so it's recovered from the beacon's
   *  referer; opens where neither is known fall into 'Unknown'. */
  opensByPage: Counted[]
  /** Listings and links visitors clicked inside chatbot replies, busiest
   *  first. */
  destinations: ClickDestination[]
}

export interface SearchPanelData {
  /** Unique users at each step of using site search. */
  funnel: {
    opened: number
    searched: number
    clicked: number
  }
  /** How search gets opened: the nav button, ⌘K, or the / key. */
  openMethods: Counted[]
  /** The pages visitors were on when they opened search (site page names). */
  opensByPage: Counted[]
  /** What people search for, busiest first (lowercased so casings group). */
  topQueries: Counted[]
  /** Searches that returned nothing — what visitors looked for and the site
   *  couldn't answer. A subset of topQueries. */
  noResultQueries: Counted[]
  /** The results visitors clicked out of search, busiest first. */
  destinations: ClickDestination[]
}

export interface VisitsData {
  /** Page views bucketed by page, busiest first — visitors or raw views,
   *  depending on the dashboard's count mode. */
  byPage: Counted[]
  /** Raw page views in range. */
  totalViews: number
  /** Distinct visitors among the page views in range. */
  uniqueVisitors: number
  /** Browsing sessions: one visitor's page views separated by 30+ minutes of
   *  inactivity count as separate visits (the definition Matomo uses too). */
  visitCount: number
}

export interface CorrelationRow {
  /** The pair of interests, e.g. 'Map' and 'Events & training' — resource
   *  pages, plus 'Chatbot' for chatbot use. */
  a: string
  b: string
  /** Visitors who engaged with BOTH (visited the page, or clicked one of its
   *  listings — clicks reach back before page-view tracking began). */
  both: number
  /** Visitors who engaged with each side at all, the overlap denominators. */
  aTotal: number
  bTotal: number
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
  /** For pages in PAGE_SPLITS: the selected page's clicks split across the
   *  page's surfaces or views (Map vs Cards on map pages, Online vs In person
   *  on Events, Upcoming vs Recurring on Training). Empty for other pages.
   *  Always the full split, even when one source is selected, so the user can
   *  switch between them. */
  bySource: Counted[]
  /** The source the per-listing panels are filtered to (a slug of one of the
   *  page's split labels, or 'untracked'), or null for all sources. Only ever
   *  set on pages in PAGE_SPLITS. */
  selectedSource: string | null
  /** Filter activations per resource page — the Overview's "how much do
   *  filters get used where" table. */
  filtersByPage: Counted[]
  /** The selected page's filter activations per filter group ('Type',
   *  'Focus', …). */
  filterGroups: Counted[]
  /** The selected page's filter activations per 'Group: Value' pair, ranked —
   *  the "which options do people actually pick" table. */
  filterValues: Counted[]
  /** Distinct visitors who turned on at least one filter on the selected page
   *  in range. */
  filterUsers: number
  /** Per page with filter activity: distinct visitors who turned on at least
   *  one filter vs the page's distinct visitors — always per-visitor,
   *  whichever count mode is active (a share of visitors only makes sense
   *  that way). `visitors` is 0 when the range predates page-view tracking. */
  filterShareByPage: { name: string; filtered: number; visitors: number }[]
  /** For pages with a map (Map, Communities): `selectedPage`'s most-hovered
   *  map listings — tooltip dwells (500 ms cursor rest on desktop, first tap
   *  on mobile), grouped like `topListings` and following the same unique/
   *  total count mode. Never narrowed by `selectedSource` (every hover is by
   *  definition from the map). Empty for pages without a map. */
  topHovered: ListingRow[]
  /** The Map tab's by-area rollup input: the page's clicks per listing with
   *  the `selectedSource` filter ignored, so the rollup's click column shares
   *  a basis with `topHovered` (which is never source-narrowed). Same rows as
   *  `topListings` when no source is selected. Empty for every page but Map —
   *  only the Map page has areas. */
  areaClicks: ListingRow[]
  funnel: ChatbotFunnel
  /** The Chatbot tab's event-derived panels (opens and reply clicks). */
  chatbot: ChatbotPanelData
  /** The Search tab's event-derived panels (opens, queries, result clicks). */
  search: SearchPanelData
  /** The privacy page's analytics switch, one bucket per browser by its latest
   *  toggle in range: `off` = switched analytics off and hasn't switched it
   *  back, `on` = switched it back on. Changing your mind moves a browser
   *  between buckets rather than counting it in both. */
  optOuts: { off: number; on: number }
  /** First-party page views (recorded from 15 July 2026). */
  visits: VisitsData
  /** Cross-interest overlaps between pages (and the chatbot), from anonymous
   *  visitor ids: pairs ranked by how many visitors engaged with both. */
  correlations: CorrelationRow[]
  /** Recent clicks and chatbot/search events — page views and map hovers are
   *  excluded so the feed stays an activity log rather than a firehose. */
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
  filtersByPage: [],
  filterGroups: [],
  filterValues: [],
  filterUsers: 0,
  filterShareByPage: [],
  topHovered: [],
  areaClicks: [],
  funnel: { opened: 0, typed: 0, clicked: 0 },
  chatbot: { opensByPage: [], destinations: [] },
  search: {
    funnel: { opened: 0, searched: 0, clicked: 0 },
    openMethods: [],
    opensByPage: [],
    topQueries: [],
    noResultQueries: [],
    destinations: [],
  },
  optOuts: { off: 0, on: 0 },
  visits: { byPage: [], totalViews: 0, uniqueVisitors: 0, visitCount: 0 },
  correlations: [],
  recent: [],
  nearCap: [],
}

/** Source filters offered on map pages. 'untracked' = neither map nor cards. */
/** Resource pages that have a map above their card list, so a click can come
 *  from either surface. Gates the hover panels (only maps emit hovers). */
const MAP_PAGES = new Set(['Map', 'Communities'])

/** Pages whose clicks are split across two surfaces or views, and the display
 *  labels of the split. A click's `source` carries the slug of the label it
 *  happened under (map pages tag the surface, Events/Training tag the active
 *  view toggle); untagged clicks — logged before the split was tracked — fall
 *  into an 'Untracked' bucket rather than being miscounted. */
const PAGE_SPLITS: Record<string, string[]> = {
  Map: ['Map', 'Cards'],
  Communities: ['Map', 'Cards'],
  Events: ['Online', 'In person'],
  Training: ['Upcoming', 'Recurring'],
}

/** 'In person' → 'in-person': how a split label appears in a click's `source`
 *  and in the dashboard's ?source query param. */
export function sourceSlug(label: string): string {
  return label.toLowerCase().replace(/ /g, '-')
}

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

/** Collapse repeat events so a visitor counts once per listing per day: keep
 *  only the most recent event per (visitor, day, page, listing). Used for
 *  listing clicks, and by topHovered for map hovers — same key, same
 *  semantics, and the two types are always deduped separately. The day uses
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
    const key = `${e.vid}\x00${day}\x00${e.page ?? ''}\x00${listingMember(e)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

/** Unique-mode dedupe for filter activations: one per visitor per group+value
 *  per Bogotá day. The group (`source`) is part of the key — the same value
 *  under two groups (e.g. 'Online') stays two activations. */
function uniqueFilterApplies(events: AnalyticsEvent[]): AnalyticsEvent[] {
  const seen = new Set<string>()
  const out: AnalyticsEvent[] = []
  for (const e of events) {
    if (!e.vid) {
      out.push(e)
      continue
    }
    const t = Date.parse(e.ts)
    const day = Number.isNaN(t)
      ? ''
      : new Date(t - 5 * 3_600_000).toISOString().slice(0, 10)
    const key = `${e.vid}\x00${day}\x00${e.page ?? ''}\x00${e.source ?? ''}\x00${e.label ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

/** Group events into one row per listing, ranked by count: the range of slots
 *  it was hit at (from positions stamped at event time — hover events carry
 *  none, so their rows get no slot) plus a representative url/id/area. Expects
 *  a newest-first list, so the first url/id/area seen for a listing is the
 *  most recent — older events only fill fields still missing. */
function listingRows(events: AnalyticsEvent[]): ListingRow[] {
  const perListing = new Map<
    string,
    {
      count: number
      positions: string[]
      url?: string
      listingId?: string
      area?: string
    }
  >()
  for (const e of events) {
    const k = listingMember(e)
    const g = perListing.get(k) ?? {
      count: 0,
      positions: [],
      url: e.url,
      listingId: e.listingId,
      area: e.area,
    }
    g.count += 1
    if (e.position) g.positions.push(e.position)
    if (!g.url && e.url) g.url = e.url
    if (!g.listingId && e.listingId) g.listingId = e.listingId
    if (!g.area && e.area) g.area = e.area
    perListing.set(k, g)
  }
  return [...perListing.entries()]
    .map(([name, g]) => ({
      name,
      count: g.count,
      position: positionRange(g.positions),
      url: g.url,
      listingId: g.listingId,
      area: g.area,
    }))
    .sort((a, b) => b.count - a.count)
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
  // the counts; in total mode every click is counted. Filtered by type, not by
  // "has a page": chatbot events also carry the page they happened on, and must
  // not count as listing clicks.
  const pageHits = inRange.filter(e => e.type === 'listing_click' && e.page)
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

  // On a page with a split (map surface, or the Events/Training view toggle)
  // the panels can be filtered to one click source. The split itself (bySource,
  // below) is always computed from every click on the page so the user can
  // switch sources; only the per-listing panels narrow.
  const split = selectedPage != null ? PAGE_SPLITS[selectedPage] : undefined
  const splitSlugs = split?.map(sourceSlug) ?? []
  const selectedSource =
    split && sourceReq && [...splitSlugs, 'untracked'].includes(sourceReq)
      ? sourceReq
      : null
  const matchesSource = (e: AnalyticsEvent): boolean => {
    if (selectedSource == null) return true // no filter
    if (selectedSource === 'untracked')
      return e.source == null || !splitSlugs.includes(e.source)
    return e.source === selectedSource
  }

  // For the selected page: total clicks per listing, the range of slots each was
  // clicked at (from positions stamped at click time, so it's period-accurate
  // even as the page is reordered), and a representative url for its favicon.
  // Every listing for the page, ranked by clicks — the dashboard shows the first
  // 50 and lets the user reveal more, so we return the full list rather than a
  // fixed top-N here.
  const pageClicksAll = clicks.filter(e => e.page === selectedPage)
  const pageClicks = pageClicksAll.filter(matchesSource)
  const topListings: ListingRow[] = listingRows(pageClicks)

  // Site-wide leaderboards, independent of the selected page: the most-clicked
  // listings and the busiest slots across every page. Keyed by page+listing so
  // the same name on two pages stays two rows (each keeps its own page pill).
  const perOverall = new Map<
    string,
    { name: string; page?: string; count: number; url?: string }
  >()
  for (const e of clicks) {
    const name = listingMember(e)
    const key = `${e.page ?? ''}\x00${name}`
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

  // Source split, only for pages in PAGE_SPLITS. Clicks are explicitly tagged
  // at click time; anything untagged (logged before source tracking, or a
  // surface we don't tag) is its own 'Untracked' bucket rather than being
  // miscounted. Honours the unique/total mode (same pageClicks). Only
  // non-empty buckets are shown.
  let bySource: Counted[] = []
  if (split) {
    const counts = new Map<string, number>(split.map(label => [label, 0]))
    let untracked = 0
    for (const e of pageClicksAll) {
      const label = split.find(l => sourceSlug(l) === e.source)
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
      else untracked += 1
    }
    bySource = [
      ...split.map(label => ({ name: label, count: counts.get(label) ?? 0 })),
      { name: 'Untracked', count: untracked },
    ].filter(r => r.count > 0)
  }

  // Filter usage. One filter_apply per value a visitor turns on; unique mode
  // counts each group+value once per visitor per day, total mode every toggle.
  const filterHits = inRange.filter(e => e.type === 'filter_apply' && e.page)
  const filterApplies = unique ? uniqueFilterApplies(filterHits) : filterHits
  const filtersByPage = tally(filterApplies.map(e => e.page as string))
  const pageFilters = filterApplies.filter(e => e.page === selectedPage)
  const filterGroups = tally(pageFilters.map(e => e.source ?? '(unknown)'))
  const filterValues = tally(
    pageFilters.map(
      e => `${e.source ?? '(unknown)'}: ${e.label ?? '(unknown)'}`
    )
  )
  const filterUsers = uniqueUsers(
    filterHits.filter(e => e.page === selectedPage)
  )

  // % of a page's visitors who filter: distinct filtering vids per page against
  // distinct page_view vids per page. Deliberately ignores the unique/total
  // mode — a share of visitors is only meaningful per-visitor.
  const filteredVidsByPage = new Map<string, Set<string>>()
  for (const e of filterHits) {
    if (!e.vid || !e.page) continue
    const set = filteredVidsByPage.get(e.page) ?? new Set<string>()
    set.add(e.vid)
    filteredVidsByPage.set(e.page, set)
  }
  const viewVidsByPage = new Map<string, Set<string>>()
  for (const e of inRange) {
    if (e.type !== 'page_view' || !e.page || !e.vid) continue
    const name = PAGE_NAME_BY_PATH[e.page] ?? e.page
    const set = viewVidsByPage.get(name) ?? new Set<string>()
    set.add(e.vid)
    viewVidsByPage.set(name, set)
  }
  const filterShareByPage = [...filteredVidsByPage.entries()]
    .map(([name, vids]) => ({
      name,
      filtered: vids.size,
      visitors: viewVidsByPage.get(name)?.size ?? 0,
    }))
    .sort((a, b) => b.filtered - a.filtered)

  // Most-hovered map listings for the selected page — tooltip dwells
  // (listing_hover events), grouped exactly like topListings but with no
  // position (hovers aren't slotted) and no source narrowing (every hover is
  // by definition from the map, so the ?source filter would be a no-op at
  // best and confusing at worst). Follows the unique/total count mode via the
  // same per-visitor-per-day dedupe as clicks. Map pages only — no other page
  // emits hover events.
  let topHovered: ListingRow[] = []
  if (selectedPage != null && MAP_PAGES.has(selectedPage)) {
    const hoverHits = inRange.filter(e => e.type === 'listing_hover' && e.page)
    const hovers = (unique ? uniqueClicks(hoverHits) : hoverHits).filter(
      e => e.page === selectedPage
    )
    topHovered = listingRows(hovers)
  }

  // The Map tab's by-area rollup compares clicks against hovers per area, and
  // topHovered is never source-narrowed — so its click side must ignore the
  // ?source filter too, or the two columns quietly stop sharing a basis the
  // moment a source is selected. Same rows as topListings when no source is
  // selected; empty on every other page (only the Map page has areas).
  const areaClicks: ListingRow[] =
    selectedPage === 'Map'
      ? selectedSource
        ? listingRows(pageClicksAll)
        : topListings
      : []

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
    filtersByPage,
    filterGroups,
    filterValues,
    filterUsers,
    filterShareByPage,
    topHovered,
    areaClicks,
    funnel: {
      opened: usersOf('chatbot_open'),
      typed: usersOf('chatbot_message'),
      clicked: usersOf('chatbot_click'),
    },
    chatbot: chatbotPanels(inRange, unique),
    search: searchPanels(inRange, unique),
    optOuts: optOutSplit(inRange),
    visits: visitsData(inRange, unique),
    correlations: correlations(inRange),
    // Newest-first already; page views and map hovers are left out so the
    // feed stays a log of deliberate actions rather than a firehose of visits
    // and passing cursors.
    recent: inRange
      .filter(e => e.type !== 'page_view' && e.type !== 'listing_hover')
      .slice(0, 50),
  }
}

/** Page paths as their resource-page analytics names, so page views line up
 *  with the names listing clicks already use ('/funding' and 'Funding' are the
 *  same interest). Unknown paths pass through as-is. */
const PAGE_NAME_BY_PATH: Record<string, string> = {
  '/': 'Home',
  '/map': 'Map',
  '/communities': 'Communities',
  '/self-study': 'Self-study',
  '/jobs': 'Jobs',
  '/funding': 'Funding',
  '/media-channels': 'Media channels',
  '/advisors': 'Advisors',
  '/projects': 'Projects',
  '/founders': 'Founders',
  '/events-and-training': 'Events & training',
  // The split successors of /events-and-training — mapped ahead of launch so
  // their views are named from the first day they exist.
  '/events': 'Events',
  '/training': 'Training',
  '/donation-guide': 'Donation guide',
  '/about': 'About',
  '/poster-map': 'Poster map',
}

/** The visits panel: page views bucketed by page. */
function visitsData(inRange: AnalyticsEvent[], unique: boolean): VisitsData {
  const views = inRange.filter(e => e.type === 'page_view')
  return {
    byPage: tallyBy(
      views,
      e => (e.page ? (PAGE_NAME_BY_PATH[e.page] ?? e.page) : 'Unknown'),
      unique
    ),
    totalViews: views.length,
    uniqueVisitors: uniqueUsers(views),
    visitCount: countVisits(views),
  }
}

/** A returning visitor starts a new visit after this much inactivity. */
const SESSION_GAP_MS = 30 * 60_000

/** Browsing sessions among the page views: each visitor's views are grouped,
 *  and a gap of SESSION_GAP_MS or more starts a new visit. Views with no
 *  visitor id (private browsing) can't be grouped, so each counts as its own
 *  visit — same spirit as uniqueUsers. */
function countVisits(views: AnalyticsEvent[]): number {
  const byVid = new Map<string, number[]>()
  let visits = 0
  for (const e of views) {
    if (!e.vid) {
      visits++
      continue
    }
    const t = Date.parse(e.ts)
    if (Number.isNaN(t)) continue
    const times = byVid.get(e.vid) ?? []
    times.push(t)
    byVid.set(e.vid, times)
  }
  for (const times of byVid.values()) {
    times.sort((a, b) => a - b)
    visits++
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] >= SESSION_GAP_MS) visits++
    }
  }
  return visits
}

/** The interest an event expresses, for the correlations table: the page it
 *  belongs to (viewed, or clicked a listing on), with 'Chatbot' and 'Search'
 *  as interests of their own. Home isn't an interest — nearly everyone passes
 *  through it, so its pairs say nothing. Listing clicks reach back to 20 June
 *  2026, so pairs have history even though page views only started on 15 July
 *  2026. */
function interestOf(e: AnalyticsEvent): string | undefined {
  if (e.type === 'page_view')
    return e.page && e.page !== '/'
      ? (PAGE_NAME_BY_PATH[e.page] ?? e.page)
      : undefined
  if (e.type === 'listing_click') return e.page
  if (e.type.startsWith('chatbot')) return 'Chatbot'
  if (e.type.startsWith('search')) return 'Search'
  return undefined
}

/** Cross-interest overlaps: for every pair of interests, how many visitors
 *  engaged with both. Needs the anonymous visitor id, so events without one
 *  (private browsing) can't contribute. Pairs seen only once are noise and
 *  dropped. */
function correlations(inRange: AnalyticsEvent[]): CorrelationRow[] {
  const byVid = new Map<string, Set<string>>()
  for (const e of inRange) {
    if (!e.vid) continue
    const interest = interestOf(e)
    if (!interest) continue
    const set = byVid.get(e.vid) ?? new Set<string>()
    set.add(interest)
    byVid.set(e.vid, set)
  }

  const totals = new Map<string, number>()
  const pairs = new Map<string, number>()
  for (const set of byVid.values()) {
    const interests = [...set].sort()
    for (const i of interests) totals.set(i, (totals.get(i) ?? 0) + 1)
    for (let x = 0; x < interests.length; x++) {
      for (let y = x + 1; y < interests.length; y++) {
        const key = `${interests[x]}\n${interests[y]}`
        pairs.set(key, (pairs.get(key) ?? 0) + 1)
      }
    }
  }

  return [...pairs.entries()]
    .filter(([, both]) => both >= 2)
    .map(([key, both]) => {
      const [a, b] = key.split('\n')
      return {
        a,
        b,
        both,
        aTotal: totals.get(a) ?? 0,
        bTotal: totals.get(b) ?? 0,
      }
    })
    .sort((p, q) => q.both - p.both)
    .slice(0, 100)
}

/** The page a chatbot event happened on: the explicitly stamped page when the
 *  event carries one (from 15 July 2026), else the path of the beacon's referer
 *  (which every earlier open still has). */
function chatbotPage(e: AnalyticsEvent): string | undefined {
  if (e.page) return e.page
  if (!e.ref) return undefined
  try {
    return new URL(e.ref).pathname || '/'
  } catch {
    return undefined
  }
}

/** Bucket events by a key, counting either distinct users per bucket (matching
 *  the funnel's unique-user semantics; events with no visitor id each count
 *  once) or raw events. */
function tallyBy(
  events: AnalyticsEvent[],
  keyOf: (e: AnalyticsEvent) => string,
  unique: boolean
): Counted[] {
  if (!unique) return tally(events.map(keyOf))
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  for (const e of events) {
    const key = keyOf(e)
    if (e.vid) {
      const dedupe = `${key}\n${e.vid}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
    }
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/** Clicked-out destinations bucketed by url, busiest first; the most recent
 *  click's label (event lists are newest-first) names the row when one was
 *  recorded. In unique mode each visitor counts once per destination.
 *  `sourceIsType` is set by the search panels, whose clicks carry the result's
 *  type in `source` — the first (newest) one seen becomes the row's
 *  resultType. Chatbot clicks use `source` for something else ('card'/'link'),
 *  so they leave it off. */
function destinationRows(
  clicks: AnalyticsEvent[],
  unique: boolean,
  sourceIsType = false
): ClickDestination[] {
  const byUrl = new Map<string, ClickDestination>()
  const seen = new Set<string>()
  for (const e of clicks) {
    const url = e.url ?? e.label ?? '(unknown)'
    if (unique && e.vid) {
      const dedupe = `${url}\n${e.vid}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
    }
    const g = byUrl.get(url) ?? { name: e.label ?? url, url: e.url, count: 0 }
    if (sourceIsType && !g.resultType && e.source) g.resultType = e.source
    g.count += 1
    byUrl.set(url, g)
  }
  return [...byUrl.values()].sort((a, b) => b.count - a.count)
}

/** The Chatbot tab's event-derived panels. `unique` mirrors the dashboard's
 *  count mode: unique users per bucket, or every event. */
function chatbotPanels(
  inRange: AnalyticsEvent[],
  unique: boolean
): ChatbotPanelData {
  const opens = inRange.filter(e => e.type === 'chatbot_open')
  const clicks = inRange.filter(e => e.type === 'chatbot_click')
  return {
    opensByPage: tallyBy(opens, e => chatbotPage(e) ?? 'Unknown', unique),
    destinations: destinationRows(clicks, unique),
  }
}

/** Dashboard labels for how the search modal was opened (search_open.source). */
const SEARCH_OPEN_LABEL: Record<string, string> = {
  button: 'Search button',
  'cmd-k': '⌘K shortcut',
  slash: '/ shortcut',
}

/** The Search tab's panels. The funnel always counts unique users; the other
 *  panels follow the dashboard's count mode via `unique`, like the chatbot's.
 *  Queries are grouped lowercased so casings don't split a search across rows.
 *  A search_query without text (not something the site's own beacons send) is
 *  ignored rather than counted as an empty search. */
function searchPanels(
  inRange: AnalyticsEvent[],
  unique: boolean
): SearchPanelData {
  const opens = inRange.filter(e => e.type === 'search_open')
  const queries = inRange.filter(e => e.type === 'search_query' && e.query)
  const clicks = inRange.filter(e => e.type === 'search_click')
  return {
    funnel: {
      opened: uniqueUsers(opens),
      searched: uniqueUsers(queries),
      clicked: uniqueUsers(clicks),
    },
    openMethods: tallyBy(
      opens,
      e => SEARCH_OPEN_LABEL[e.source ?? ''] ?? 'Unknown',
      unique
    ),
    opensByPage: tallyBy(
      opens,
      e => (e.page ? (PAGE_NAME_BY_PATH[e.page] ?? e.page) : 'Unknown'),
      unique
    ),
    topQueries: tallyBy(queries, e => e.query!.toLowerCase(), unique),
    noResultQueries: tallyBy(
      queries.filter(e => e.results === 0),
      e => e.query!.toLowerCase(),
      unique
    ),
    destinations: destinationRows(clicks, unique, true),
  }
}

/** The privacy switch's toggle events bucketed by each browser's latest state:
 *  `off` = the latest toggle turned analytics off, `on` = the latest toggle
 *  turned it back on. Decided per vid by timestamp (ISO strings compare
 *  chronologically), so flip-flopping counts the browser once, under where it
 *  ended up. Vid-less events can't be paired with a later change of mind, so
 *  each counts once under the state it reported. */
function optOutSplit(events: AnalyticsEvent[]): { off: number; on: number } {
  const latestByVid = new Map<string, AnalyticsEvent>()
  let off = 0
  let on = 0
  for (const e of events) {
    if (e.type !== 'analytics_optout' && e.type !== 'analytics_optin') continue
    if (!e.vid) {
      if (e.type === 'analytics_optout') off++
      else on++
      continue
    }
    const prev = latestByVid.get(e.vid)
    if (!prev || e.ts > prev.ts) latestByVid.set(e.vid, e)
  }
  for (const e of latestByVid.values()) {
    if (e.type === 'analytics_optout') off++
    else on++
  }
  return { off, on }
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
