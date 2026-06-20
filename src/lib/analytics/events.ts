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
  topFunding: Counted[]
  funnel: ChatbotFunnel
  recent: AnalyticsEvent[]
}

const EMPTY: Omit<DashboardData, 'source'> = {
  totalEvents: 0,
  byPage: [],
  topFunding: [],
  funnel: { opened: 0, typed: 0, clicked: 0 },
  recent: [],
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

/** Aggregate a newest-first event list into the dashboard view, filtered to the
 *  given date range. */
function aggregate(
  all: AnalyticsEvent[],
  { startMs, endMs }: DateRange
): Omit<DashboardData, 'source' | 'error'> {
  const inRange = all.filter(e => {
    const t = Date.parse(e.ts)
    if (Number.isNaN(t)) return false
    if (startMs != null && t < startMs) return false
    if (endMs != null && t > endMs) return false
    return true
  })
  const clicks = inRange.filter(e => e.page)
  const usersOf = (type: string) =>
    uniqueUsers(inRange.filter(e => e.type === type))
  return {
    totalEvents: inRange.length,
    byPage: tally(clicks.map(e => e.page as string)),
    topFunding: tally(
      clicks.filter(e => e.page === 'Funding').map(e => listingMember(e))
    ).slice(0, 15),
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

export async function readDashboard(range: DateRange): Promise<DashboardData> {
  if (store) {
    try {
      // Newest-first (lpush prepends); up to MAX_EVENTS.
      const all = await store.lrange<AnalyticsEvent>(EVENTS_KEY, 0, -1)
      return { source: 'redis', ...aggregate(all, range) }
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
  return { source: 'local-file', ...aggregate(all, range) }
}
