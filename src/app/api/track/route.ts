import { NextRequest, after } from 'next/server'
import {
  recordEvent,
  allowTrack,
  ALLOWED_EVENT_TYPES,
  type AnalyticsEvent,
} from '@/lib/analytics/events'
import { getClientIp } from '@/lib/assistant/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// First-party analytics ingest. Public (like the assistant log endpoint) — it's
// a fire-and-forget beacon from the browser. Validation is intentionally light
// but every field is length-capped so a bad/abusive payload can't bloat storage.

/** Coerce an unknown to a trimmed, length-capped string, or undefined. */
function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (!s) return undefined
  return s.length > max ? s.slice(0, max) : s
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return new Response('invalid event', { status: 400 })
  }
  const b = body as Record<string, unknown>
  const type = str(b.type, 64)
  // Only known event kinds are accepted — this keeps a public caller from
  // minting unlimited counter entries in the shared Redis database.
  if (!type || !ALLOWED_EVENT_TYPES.has(type)) {
    return new Response('invalid type', { status: 400 })
  }

  const event: AnalyticsEvent = {
    type,
    page: str(b.page, 64),
    listingId: str(b.listingId, 64),
    label: str(b.label, 300),
    url: str(b.url, 600),
    ref: str(req.headers.get('referer'), 600),
    vid: str(b.vid, 64),
    ts: new Date().toISOString(), // server clock, not the client's
  }

  const ip = getClientIp(req.headers)
  // after() keeps the function alive until the write completes; a bare promise
  // gets frozen once the 204 returns and the event would be lost on Vercel. The
  // rate-limit check runs here too so it never delays the beacon response.
  after(async () => {
    if (await allowTrack(ip)) await recordEvent(event)
  })
  return new Response(null, { status: 204 })
}
