import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/** Per-IP rate limits for the assistant endpoint. Strict by design — we're a
 *  small nonprofit paying for tokens out of a fixed grant. */
const HOURLY_LIMIT = 10
const DAILY_LIMIT = 50

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

const hourlyLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(HOURLY_LIMIT, '1 h'),
      analytics: false,
      prefix: 'aisafety:assistant:hour',
    })
  : null

const dailyLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(DAILY_LIMIT, '1 d'),
      analytics: false,
      prefix: 'aisafety:assistant:day',
    })
  : null

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; window: 'hour' | 'day' }

export async function checkAssistantRateLimit(
  ip: string
): Promise<RateLimitResult> {
  if (!hourlyLimit || !dailyLimit) {
    // Redis not configured (dev or misconfigured prod). Allow the request so
    // local dev still works; production builds without redis will be visible
    // in Vercel env-var diff.
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[rate-limit] Upstash Redis env vars missing in production – assistant requests are unrestricted.'
      )
    }
    return { ok: true }
  }

  const [hourResult, dayResult] = await Promise.all([
    hourlyLimit.limit(ip),
    dailyLimit.limit(ip),
  ])

  if (!hourResult.success) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((hourResult.reset - Date.now()) / 1000)
      ),
      window: 'hour',
    }
  }
  if (!dayResult.success) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((dayResult.reset - Date.now()) / 1000)
      ),
      window: 'day',
    }
  }
  return { ok: true }
}

/** Extract a client IP from request headers. Falls back to a stable string so
 *  unknown-IP traffic still shares a single bucket rather than bypassing
 *  limits entirely. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') ?? 'unknown'
}
