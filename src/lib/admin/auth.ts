import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'aisafety_admin'
// 30 days. Re-auth when expired.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** Passwords that grant admin access: the primary owner password plus an
 *  optional secondary one (e.g. a shareable "successif…" password handed to a
 *  partner reviewing the chat logs). Each lives in its own env var, so either
 *  can be revoked on its own — drop `ADMIN_PASSWORD_SUCCESSIF` and that
 *  password (and any cookie derived from it) stops working immediately, while
 *  the primary is untouched. */
function validPasswords(): string[] {
  return [
    process.env.ADMIN_PASSWORD,
    process.env.ADMIN_PASSWORD_SUCCESSIF,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0)
}

/** Cookie value derived from a password. Forging the cookie therefore requires
 *  knowing a valid password — pasting any literal string into the browser
 *  cookie store will not pass `isAdmin()`. */
function cookieValueFor(password: string): string {
  return createHash('sha256')
    .update(`${password}:aisafety-admin-v1`)
    .digest('hex')
}

export async function isAdmin(): Promise<boolean> {
  const accepted = validPasswords().map(cookieValueFor)
  if (accepted.length === 0) return false
  const c = await cookies()
  const got = c.get(COOKIE_NAME)?.value
  return got != null && accepted.includes(got)
}

/** True only when the session was authenticated with the PRIMARY owner password
 *  (ADMIN_PASSWORD) — NOT the shared, revocable ADMIN_PASSWORD_SUCCESSIF. Use
 *  this to gate owner-only areas (e.g. the analytics dashboard) so a partner
 *  holding the Successif password can't reach them. Fails closed if the primary
 *  password isn't configured. */
export async function isOwner(): Promise<boolean> {
  const primary = process.env.ADMIN_PASSWORD
  if (!primary) return false
  const c = await cookies()
  const got = c.get(COOKIE_NAME)?.value
  return got != null && got === cookieValueFor(primary)
}

export async function setAdminCookie(password: string): Promise<void> {
  // Only mint a cookie for a password we actually accept.
  if (!validPasswords().includes(password)) return
  const c = await cookies()
  c.set({
    name: COOKIE_NAME,
    value: cookieValueFor(password),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

export async function clearAdminCookie(): Promise<void> {
  const c = await cookies()
  c.delete(COOKIE_NAME)
}

export function checkAdminPassword(password: unknown): boolean {
  if (typeof password !== 'string') return false
  const valids = validPasswords()
  if (valids.length === 0) return false
  // Constant-time compare against each accepted password. Iterate the longer of
  // the two so an attacker cannot infer a password's length by measuring
  // response time, and never early-exit (OR the per-candidate results) so the
  // number of configured passwords isn't observable either.
  let matched = false
  for (const expected of valids) {
    const len = Math.max(password.length, expected.length)
    let diff = password.length ^ expected.length
    for (let i = 0; i < len; i++) {
      diff |= (password.charCodeAt(i) | 0) ^ (expected.charCodeAt(i) | 0)
    }
    matched = matched || diff === 0
  }
  return matched
}
