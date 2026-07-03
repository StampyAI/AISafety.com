import { NextResponse } from 'next/server'

// Newsletter keys the form is allowed to log signups for. Kept server-side so
// the endpoint can't be abused as an open relay, and ready for when the
// signup form is globalized into a shared component.
const NEWSLETTERS = new Set(['events', 'funding', 'aisafety'])

// Every submission is logged to the "Newsletter signups" Airtable table.
// Substack's bot protection blocks any non-browser subscribe call (403), so
// the actual subscription happens client-side by handing the visitor to
// Substack's own subscribe page; this log is the recoverable record of every
// address entered, in case that handoff isn't completed. Field keys are IDs
// (rename-proof).
const LOG_TABLE_ID = 'tblifTJBO8vEZ4qZd'
const LOG_FIELDS = {
  email: 'fld5p9c56KMqX4pXg',
  newsletter: 'fldaXk99KbZZxpvlS',
  result: 'fldqexYQt8Coimyi0',
  date: 'fld4XoLdMmos4HveL',
}

// In-memory per-IP throttle to keep scripted abuse from flooding the log.
// Per-instance and reset on cold start, which is acceptable as a dampener.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000
const submissionsByIp = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (submissionsByIp.get(ip) ?? []).filter(
    t => now - t < RATE_WINDOW_MS
  )
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  // Bound memory: if the map grows unreasonably, start over rather than leak.
  if (submissionsByIp.size > 5000) submissionsByIp.clear()
  submissionsByIp.set(ip, recent)
  return false
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 }
    )
  }

  const { email: rawEmail, newsletter } = (body ?? {}) as {
    email?: unknown
    newsletter?: unknown
  }

  const email = typeof rawEmail === 'string' ? rawEmail.trim() : ''
  if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_email' },
      { status: 400 }
    )
  }

  if (typeof newsletter !== 'string' || !NEWSLETTERS.has(newsletter)) {
    return NextResponse.json(
      { ok: false, error: 'unknown_newsletter' },
      { status: 400 }
    )
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    console.warn(`[subscribe] rate-limited ip=${ip}`)
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429 }
    )
  }

  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!token || !baseId) {
    console.warn('[subscribe] Airtable log skipped: missing env vars')
    return NextResponse.json(
      { ok: false, error: 'not_configured' },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${LOG_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            [LOG_FIELDS.email]: email,
            [LOG_FIELDS.newsletter]: newsletter,
            [LOG_FIELDS.result]: 'Sent to Substack signup page',
            [LOG_FIELDS.date]: new Date().toISOString(),
          },
        }),
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      }
    )
    if (!res.ok) {
      const text = await res.text()
      console.warn(
        `[subscribe] Airtable log failed: ${res.status} ${text.slice(0, 200)}`
      )
      return NextResponse.json(
        { ok: false, error: 'log_failed' },
        { status: 502 }
      )
    }
  } catch (err) {
    console.warn('[subscribe] Airtable log failed:', err)
    return NextResponse.json(
      { ok: false, error: 'log_failed' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
