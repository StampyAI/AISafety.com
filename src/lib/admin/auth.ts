import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'aisafety_admin'
// 30 days. Re-auth when expired.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** Cookie value derived from ADMIN_PASSWORD. Forging the cookie therefore
 *  requires knowing the password — pasting any literal string into the
 *  browser cookie store will not pass `isAdmin()`. */
function expectedCookieValue(): string | null {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null
  return createHash('sha256').update(`${pw}:aisafety-admin-v1`).digest('hex')
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedCookieValue()
  if (!expected) return false
  const c = await cookies()
  return c.get(COOKIE_NAME)?.value === expected
}

export async function setAdminCookie(): Promise<void> {
  const value = expectedCookieValue()
  if (!value) return
  const c = await cookies()
  c.set({
    name: COOKIE_NAME,
    value,
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
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  if (typeof password !== 'string') return false
  // Constant-time compare. Iterate the longer of the two so an attacker
  // cannot infer the expected length by measuring response time, then fold
  // the length mismatch into the result.
  const len = Math.max(password.length, expected.length)
  let diff = password.length ^ expected.length
  for (let i = 0; i < len; i++) {
    diff |= (password.charCodeAt(i) | 0) ^ (expected.charCodeAt(i) | 0)
  }
  return diff === 0
}
