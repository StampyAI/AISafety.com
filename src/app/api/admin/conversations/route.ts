import { NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin/auth'
import {
  isConversationsTableConfigured,
  listConversations,
  updateConversation,
} from '@/lib/admin/airtable'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function ensureAuth(): Promise<Response | null> {
  if (!(await isAdmin())) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!isConversationsTableConfigured()) {
    return new Response(
      JSON.stringify({ error: 'ADMIN_CONVERSATIONS_TABLE_ID not set' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
  return null
}

export async function GET(req: NextRequest) {
  const auth = await ensureAuth()
  if (auth) return auth
  const url = new URL(req.url)
  const rawLimit = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(Math.floor(rawLimit), 200))
    : 50
  const zeroOnly = url.searchParams.get('zeroOnly') === '1'
  const conversations = await listConversations({ limit })
  // zeroMatches now lives inside Data; filter client-side here so the API
  // contract stays the same for the admin viewer.
  const filtered = zeroOnly
    ? conversations.filter(c => c.data?.zeroMatches === true)
    : conversations
  return Response.json({ conversations: filtered })
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAuth()
  if (auth) return auth
  let body: { id?: unknown; notes?: unknown; tags?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  if (typeof body.id !== 'string' || !body.id) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const patch: { notes?: string; tags?: string[] } = {}
  if (typeof body.notes === 'string') patch.notes = body.notes
  if (Array.isArray(body.tags) && body.tags.every(t => typeof t === 'string')) {
    patch.tags = body.tags as string[]
  }
  const updated = await updateConversation(body.id, patch)
  return Response.json({ conversation: updated })
}
