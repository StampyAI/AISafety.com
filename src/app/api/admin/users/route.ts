/*
  Admin admin API — who can sign in with Google and which tabs they get
  (sessions with the manageUsers area only).

  GET    /api/admin/users  → { users, requests, shared }
  POST   /api/admin/users  body { email, access }                → 201 { user }
  PATCH  /api/admin/users  body { email, access }                → { user }
  DELETE /api/admin/users  body { email }                        → 204

  `access` is an object of booleans keyed by area (src/lib/admin/access.ts).
  Names are not entered here: Google supplies them at first sign-in, or with
  the access request when someone unknown tried to sign in. Adding an email
  that has a pending request approves it (its name is kept, the request goes).
  Writes additionally need a Google session under SENSITIVE_FRESH_SECONDS old
  and answer 401 { error: 'reauth' } otherwise; the page reacts by sending the
  browser through Google and back. Root admins (users.ts) can't be edited or
  removed here, and nobody can remove their own login or untick their own
  Admin admin access.
*/

import { after, NextRequest } from 'next/server'
import {
  canManageUsers,
  currentAdmin,
  hasFreshSession,
  SENSITIVE_FRESH_SECONDS,
} from '@/lib/admin/auth'
import { ACCESS_AREAS, type AccessFlags } from '@/lib/admin/access'
import { audit, recentAudit } from '@/lib/admin/audit'
import { approvedMail, sendAdminMail } from '@/lib/admin/mail'
import { publicOrigin } from '@/lib/admin/origin'
import {
  isRootAdmin,
  normaliseEmail,
  ROOT_ADMINS,
  validateAccess,
  validateUserInput,
} from '@/lib/admin/users'
import { usersStore, usersStoreIsShared } from '@/lib/admin/users-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

async function ensureAuth(write: boolean): Promise<Response | null> {
  if (!(await canManageUsers())) return json({ error: 'unauthorized' }, 401)
  if (write && !(await hasFreshSession(SENSITIVE_FRESH_SECONDS))) {
    return json({ error: 'reauth' }, 401)
  }
  return null
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json()
    return body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export async function GET() {
  const auth = await ensureAuth(false)
  if (auth) return auth
  const me = await currentAdmin()
  const [managed, signIns, requests, activity] = await Promise.all([
    usersStore.list(),
    usersStore.lastSignIns().catch(() => ({}) as Record<string, string>),
    usersStore.listRequests().catch(() => []),
    recentAudit(60),
  ])
  const users = [
    ...ROOT_ADMINS.map(u => ({
      email: u.email,
      name: u.name,
      access: u.access,
      builtIn: true,
      isMe: me?.email === u.email,
      addedAt: null,
      addedBy: null,
      lastSignInAt: signIns[u.email] ?? null,
    })),
    ...managed.map(u => ({
      email: u.email,
      name: u.name,
      access: u.access,
      builtIn: false,
      isMe: me?.email === u.email,
      addedAt: u.addedAt,
      addedBy: u.addedBy,
      lastSignInAt: signIns[u.email] ?? null,
    })),
  ]
  return json({
    users,
    requests: [...requests].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)),
    activity,
    shared: usersStoreIsShared,
  })
}

/** "Analytics, Newsletters" — for the activity trail. */
const tabsOn = (a: AccessFlags) =>
  ACCESS_AREAS.filter(x => a[x.key])
    .map(x => x.label)
    .join(', ')

const summarise = (a: AccessFlags) =>
  Object.entries(a)
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(',')

export async function POST(req: NextRequest) {
  const auth = await ensureAuth(true)
  if (auth) return auth
  const checked = validateUserInput(await readBody(req))
  if (!checked.ok) return json({ error: checked.error }, 400)
  const me = await currentAdmin()
  // Approving someone who asked: keep the name Google gave us with the request.
  const request = (await usersStore.listRequests().catch(() => [])).find(
    r => r.email === checked.value.email
  )
  const user = {
    ...checked.value,
    name: request?.name ?? null,
    addedAt: new Date().toISOString(),
    addedBy: me?.name ?? 'unknown',
  }
  try {
    await usersStore.add(user)
  } catch (err) {
    if (err instanceof Error && err.message === 'duplicate') {
      return json({ error: 'That address is already on the list.' }, 409)
    }
    throw err
  }
  if (request) {
    await usersStore
      .removeRequest(user.email)
      .catch(err => console.warn('[admin-users] request cleanup failed:', err))
  }
  console.log(
    `[admin-users] ${user.addedBy} ${request ? 'approved' : 'added'} ${user.email} with ${summarise(user.access)}`
  )
  after(() =>
    audit({
      kind: request ? 'approved' : 'added',
      actor: user.addedBy,
      subject: user.email,
      detail: tabsOn(user.access),
    })
  )
  // Let them know, after the response has gone out.
  const loginUrl = `${publicOrigin(req)}/admin/login`
  after(() =>
    sendAdminMail(
      'approved',
      user.email,
      approvedMail({
        email: user.email,
        name: user.name,
        loginUrl,
      })
    )
  )
  return json({ user }, 201)
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAuth(true)
  if (auth) return auth
  const body = await readBody(req)
  if (typeof body.email !== 'string') return json({ error: 'Which user?' }, 400)
  const email = normaliseEmail(body.email)
  if (isRootAdmin(email)) {
    return json({ error: 'Built-in admins are changed in the code.' }, 400)
  }
  const me = await currentAdmin()
  const checked = validateAccess(body.access)
  if (!checked.ok) return json({ error: checked.error }, 400)
  if (me?.email === email && !checked.value.manageUsers) {
    return json(
      { error: "You can't remove your own access to this page." },
      400
    )
  }
  const patch: { access: AccessFlags } = { access: checked.value }
  const user = await usersStore.update(email, patch)
  if (!user) return json({ error: 'No such user.' }, 404)
  after(() =>
    audit({
      kind: 'access-changed',
      actor: me?.name ?? 'unknown',
      subject: email,
      detail: tabsOn(patch.access),
    })
  )
  console.log(
    `[admin-users] ${me?.name ?? 'unknown'} changed ${email}: access=${summarise(patch.access)}`
  )
  return json({ user })
}

export async function DELETE(req: NextRequest) {
  const auth = await ensureAuth(true)
  if (auth) return auth
  const body = await readBody(req)
  if (typeof body.email !== 'string') return json({ error: 'Which user?' }, 400)
  const email = normaliseEmail(body.email)
  if (isRootAdmin(email)) {
    return json({ error: 'Built-in admins are changed in the code.' }, 400)
  }
  const me = await currentAdmin()
  if (me?.email === email) {
    return json({ error: "You can't remove your own login." }, 400)
  }
  const removed = await usersStore.remove(email)
  if (!removed) return json({ error: 'No such user.' }, 404)
  after(() =>
    audit({ kind: 'removed', actor: me?.name ?? 'unknown', subject: email })
  )
  console.log(`[admin-users] ${me?.name ?? 'unknown'} removed ${email}`)
  return new Response(null, { status: 204 })
}
