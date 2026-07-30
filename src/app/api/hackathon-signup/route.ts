import { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getClientIp } from '@/lib/assistant/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The Apps Script roundtrip (append row + send confirmation email) can take a
// few seconds on a cold start.
export const maxDuration = 30

// Google Apps Script web app attached to the private applications Sheet. It
// appends a row and emails the applicant a confirmation — see
// docs/hackathon-signup.md.
const SCRIPT_URL = process.env.HACKATHON_SCRIPT_URL
const SECRET = process.env.HACKATHON_FORM_SECRET

// Same env fallbacks as lib/assistant/rate-limit.ts (Vercel-Upstash naming
// first, upstream Upstash naming second).
const restUrl =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const restToken =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
const redis =
  restUrl && restToken ? new Redis({ url: restUrl, token: restToken }) : null

// Loose per-IP cap. Its real job is protecting the Gmail quota behind the
// confirmation emails (~100 sends/day) from a scripted flood.
const limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: false,
      prefix: 'aisafety:hackathon',
    })
  : null

/** Coerce an unknown to a trimmed, length-capped string. */
function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
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
    return new Response('invalid application', { status: 400 })
  }
  const b = body as Record<string, unknown>

  // Honeypot filled in → almost certainly a bot. Pretend success so it
  // doesn't learn to adapt; nothing is stored or emailed.
  if (str(b.website, 10)) {
    return new Response(null, { status: 204 })
  }

  const tracks = Array.isArray(b.tracks)
    ? b.tracks
        .map(t => str(t, 120))
        .filter(Boolean)
        .slice(0, 10)
    : []

  const application = {
    name: str(b.name, 200),
    email: str(b.email, 320),
    tracks,
    skills: str(b.skills, 5000),
    dietary: str(b.dietary, 2000),
    medical: str(b.medical, 2000),
    roomPreference: str(b.roomPreference, 100),
    emergencyContact: str(b.emergencyContact, 500),
    anythingElse: str(b.anythingElse, 5000),
    successfulProjects: str(b.successfulProjects, 5000),
    arrival: str(b.arrival, 20),
    departure: str(b.departure, 20),
    over18: b.over18 === true,
  }

  const required: (keyof typeof application)[] = [
    'name',
    'email',
    'skills',
    'roomPreference',
    'emergencyContact',
  ]
  if (
    required.some(f => !application[f]) ||
    tracks.length === 0 ||
    !application.over18
  ) {
    return new Response('missing required fields', { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) {
    return new Response('invalid email', { status: 400 })
  }

  if (limiter) {
    const { success } = await limiter.limit(getClientIp(req.headers))
    if (!success) {
      return new Response('rate limited', { status: 429 })
    }
  }

  if (!SCRIPT_URL || !SECRET) {
    if (process.env.NODE_ENV !== 'production') {
      // Lets the form be exercised locally before the Apps Script exists.
      console.log('[hackathon-signup] not configured; would send:', application)
      return new Response(null, { status: 204 })
    }
    console.error(
      '[hackathon-signup] HACKATHON_SCRIPT_URL / HACKATHON_FORM_SECRET not set'
    )
    return new Response('application not configured', { status: 500 })
  }

  // Await the write: the user needs to know their application was actually
  // stored before we show success. (Apps Script replies via a 302 fetch
  // follows.)
  let result: { ok?: boolean }
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...application, secret: SECRET }),
      signal: AbortSignal.timeout(20_000),
    })
    result = (await res.json()) as { ok?: boolean }
  } catch (err) {
    console.error('[hackathon-signup] Apps Script call failed:', err)
    return new Response('application failed', { status: 502 })
  }
  if (!result.ok) {
    console.error(
      '[hackathon-signup] Apps Script rejected application:',
      result
    )
    return new Response('application failed', { status: 502 })
  }

  return new Response(null, { status: 204 })
}
