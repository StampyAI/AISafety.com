import { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getClientIp } from '@/lib/assistant/rate-limit'
import {
  FIELDS,
  OTHER_MAX,
  PROJECTS,
  RATINGS,
  WHY_FROM,
  WHY_MAX,
  maxLen,
  needsTravelNotes,
  plainLabel,
} from '@/app/hackathon/details/questions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The Apps Script roundtrip (append row + send confirmation email) can take a
// few seconds on a cold start.
export const maxDuration = 30

// The same Apps Script web app as /api/hackathon-signup; a `form: 'details'`
// marker routes this form's answers to their own tab in the private Sheet.
// See docs/hackathon-signup.md.
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

// Loose per-IP cap – protects the Gmail quota behind the confirmation emails
// (~100 sends/day) from a scripted flood.
const limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: false,
      prefix: 'aisafety:hackathon-details',
    })
  : null

/** Coerce an unknown to a trimmed, length-capped string. */
function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  return s.length > max ? s.slice(0, max) : s
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return new Response('invalid submission', { status: 400 })
  }
  const b = body as Record<string, unknown>

  // Honeypot filled in → almost certainly a bot. Pretend success so it
  // doesn't learn to adapt; nothing is stored or emailed.
  if (str(b.website, 10)) {
    return new Response(null, { status: 204 })
  }

  // Walk the question spec, validating each answer and collecting
  // [label, value] pairs in form order – the Apps Script maps them into
  // Sheet columns by label and echoes them in the confirmation email.
  const answers: [string, string][] = []
  const missing: string[] = []
  let email = ''

  for (const f of FIELDS) {
    const label = plainLabel(f.label)
    switch (f.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'textarea':
      case 'select': {
        const v = str(b[f.key], maxLen(f))
        if (f.type === 'select' && v && !f.options.includes(v)) {
          return new Response('invalid option', { status: 400 })
        }
        if (f.type === 'email') {
          if (v && !EMAIL_RE.test(v)) {
            return new Response('invalid email', { status: 400 })
          }
          email = v
        }
        if (f.required && !v) missing.push(f.key)
        answers.push([label, v])
        break
      }

      case 'checkboxes': {
        const raw = b[f.key]
        const picked = Array.isArray(raw)
          ? f.options.filter(o => raw.includes(o))
          : []
        const other = f.other ? str(b[`${f.key}Other`], OTHER_MAX) : ''
        const v = [...picked, other && `Other: ${other}`]
          .filter(Boolean)
          .join(', ')
        if (f.required && !v) missing.push(f.key)
        answers.push([label, v])
        break
      }

      case 'agree': {
        const yes = b[f.key] === true
        if (f.required && !yes) missing.push(f.key)
        answers.push([label, yes ? 'Yes' : ''])
        break
      }

      case 'projects': {
        const raw =
          b[f.key] && typeof b[f.key] === 'object'
            ? (b[f.key] as Record<string, unknown>)
            : {}
        for (const p of PROJECTS) {
          const a =
            raw[p.name] && typeof raw[p.name] === 'object'
              ? (raw[p.name] as Record<string, unknown>)
              : {}
          const rating = (RATINGS as readonly number[]).includes(
            a.rating as number
          )
            ? (a.rating as number)
            : 0
          // A "why" only counts for ratings that show the box; anything else
          // is stale text from a since-lowered rating.
          const why = rating >= WHY_FROM ? str(a.why, WHY_MAX) : ''
          if (f.required && !rating) missing.push(f.key)
          if (rating >= WHY_FROM && !why) missing.push(`${f.key}:${p.name}`)
          answers.push([
            `${f.short} – ${p.name}`,
            rating ? (why ? `${rating} – ${why}` : String(rating)) : '',
          ])
        }
        break
      }
    }
  }

  if (needsTravelNotes(b)) missing.push('travelNotes')
  if (missing.length) {
    return new Response('missing required fields', { status: 400 })
  }

  if (limiter) {
    const { success } = await limiter.limit(getClientIp(req.headers))
    if (!success) {
      return new Response('rate limited', { status: 429 })
    }
  }

  if (!SCRIPT_URL || !SECRET) {
    if (process.env.NODE_ENV !== 'production') {
      // Lets the form be exercised locally without the Apps Script.
      console.log('[hackathon-details] not configured; would send:', answers)
      return new Response(null, { status: 204 })
    }
    console.error(
      '[hackathon-details] HACKATHON_SCRIPT_URL / HACKATHON_FORM_SECRET not set'
    )
    return new Response('form not configured', { status: 500 })
  }

  // Await the write: the user needs to know their details were actually
  // stored before we show success. The script confirms it handled this as
  // the details form by echoing `form` back; a script version that predates
  // the details form (which ignores `details` and would only append an
  // empty row to the applications tab) doesn't, and we report failure.
  let result: { ok?: boolean; form?: string; emailed?: boolean }
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: SECRET,
        form: 'details',
        details: { email, answers },
      }),
      signal: AbortSignal.timeout(20_000),
    })
    result = (await res.json()) as typeof result
  } catch (err) {
    console.error('[hackathon-details] Apps Script call failed:', err)
    return new Response('submission failed', { status: 502 })
  }
  if (!result.ok || result.form !== 'details') {
    console.error(
      '[hackathon-details] Apps Script rejected or mishandled submission:',
      result
    )
    return new Response('submission failed', { status: 502 })
  }
  if (result.emailed === false) {
    // The row is stored; only the confirmation email failed (e.g. Gmail
    // quota). Not worth failing the submission over – it would just prompt
    // a duplicate – but worth seeing in the logs.
    console.warn('[hackathon-details] stored, but confirmation email failed')
  }

  return new Response(null, { status: 204 })
}
