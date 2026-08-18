import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'aisafety_admin'
// 30 days. Re-auth when expired.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

interface PasswordRole {
  /** Env var holding the password. Unset or empty means this role is disabled. */
  env: string
  /** May open the playground and conversation log, and read chat transcripts. */
  chatbot: boolean
  /** May open the analytics dashboard. */
  analytics: boolean
  /** May open the map editor and move logos on the Field map (writes x/y to
   *  Airtable). Owner only for now. */
  mapEditor: boolean
}

/** Every password that grants admin access, and the areas each one opens. Each
 *  lives in its own env var, so any one can be revoked on its own — drop the env
 *  var and that password (and any cookie derived from it) stops working
 *  immediately, while the others are untouched. */
const PASSWORD_ROLES: PasswordRole[] = [
  // Primary owner password: the whole admin.
  { env: 'ADMIN_PASSWORD', chatbot: true, analytics: true, mapEditor: true },
  // Partner reviewing chat logs: chat areas only, no analytics.
  {
    env: 'ADMIN_PASSWORD_SUCCESSIF',
    chatbot: true,
    analytics: false,
    mapEditor: false,
  },
  // Site volunteers: the whole admin except the map editor (it writes to the
  // live Airtable base).
  {
    env: 'ADMIN_PASSWORD_VOLUNTEER',
    chatbot: true,
    analytics: true,
    mapEditor: false,
  },
  // Analytics-only volunteers: the dashboard, with the chat areas out of reach.
  {
    env: 'ADMIN_PASSWORD_ANALYTICS',
    chatbot: false,
    analytics: true,
    mapEditor: false,
  },
  // Melissa (site designer): the whole admin except the map editor, on her
  // own password so it can be revoked without touching the volunteers'.
  {
    env: 'ADMIN_PASSWORD_MELISSA',
    chatbot: true,
    analytics: true,
    mapEditor: false,
  },
]

/** Configured passwords whose role satisfies `grants`. Roles left unconfigured
 *  drop out, so every caller fails closed on an empty list. */
function passwordsWhere(grants: (role: PasswordRole) => boolean): string[] {
  return PASSWORD_ROLES.filter(grants)
    .map(role => process.env[role.env])
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
}

function validPasswords(): string[] {
  return passwordsWhere(() => true)
}

/** Cookie value derived from a password. Forging the cookie therefore requires
 *  knowing a valid password — pasting any literal string into the browser
 *  cookie store will not pass `isAdmin()`. */
function cookieValueFor(password: string): string {
  return createHash('sha256')
    .update(`${password}:aisafety-admin-v1`)
    .digest('hex')
}

/** True when the session's cookie was derived from one of `passwords`. */
async function sessionHolds(passwords: string[]): Promise<boolean> {
  const accepted = passwords.map(cookieValueFor)
  if (accepted.length === 0) return false
  const c = await cookies()
  const got = c.get(COOKIE_NAME)?.value
  return got != null && accepted.includes(got)
}

/** Signed in with any accepted password. Use this only to tell "signed in" from
 *  "signed out" — for anything gating a section of the admin, ask the specific
 *  capability instead, since not every password reaches every area. */
export async function isAdmin(): Promise<boolean> {
  return sessionHolds(validPasswords())
}

/** True when the session may use the playground and conversation log, and read
 *  chat transcripts. The analytics-only password is deliberately excluded — that
 *  volunteer sees the dashboard and nothing else. */
export async function canViewChatbot(): Promise<boolean> {
  return sessionHolds(passwordsWhere(role => role.chatbot))
}

/** True when the session may open the analytics dashboard. The Successif
 *  password is deliberately excluded — that partner reviews chat logs only. */
export async function canViewAnalytics(): Promise<boolean> {
  return sessionHolds(passwordsWhere(role => role.analytics))
}

/** True when the session may open the map editor and move logos on the Field
 *  map. Only the owner password — every save is a write to the live base. */
export async function canEditMap(): Promise<boolean> {
  return sessionHolds(passwordsWhere(role => role.mapEditor))
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
