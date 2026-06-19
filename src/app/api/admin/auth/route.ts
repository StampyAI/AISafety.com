import { NextRequest } from 'next/server'
import {
  checkAdminPassword,
  clearAdminCookie,
  setAdminCookie,
} from '@/lib/admin/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { password?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  if (!checkAdminPassword(body.password)) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  // checkAdminPassword has confirmed this is one of the accepted passwords;
  // mint the cookie derived from it so isAdmin() recognises the session.
  await setAdminCookie(body.password as string)
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE() {
  await clearAdminCookie()
  return new Response(null, { status: 204 })
}
