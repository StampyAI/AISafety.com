import { NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin/auth'
import {
  isConversationsTableConfigured,
  listConversationsPage,
  updateConversation,
} from '@/lib/admin/airtable'
import { getCatalog } from '@/lib/assistant/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pulls the listing ids out of every [[card:ID|note]] token in a reply. */
const CARD_ID_RE = /\[\[\s*card\s*:\s*([^\]|\n]+?)(?:\s*\|[^\]\n]*)?\s*\]\]/gi
function collectCardIds(text: string, into: Set<string>): void {
  CARD_ID_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CARD_ID_RE.exec(text)) !== null) {
    into.add(m[1].replace(/\s+/g, ''))
  }
}

const REC_RE = /rec[A-Za-z0-9]+/

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
  const rawLimit = Number(url.searchParams.get('limit') ?? '200')
  const pageSize = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(Math.floor(rawLimit), 200))
    : 200
  const offsetParam = url.searchParams.get('offset') || undefined
  const zeroOnly = url.searchParams.get('zeroOnly') === '1'
  const search = url.searchParams.get('search') || undefined
  const { conversations, offset } = await listConversationsPage({
    pageSize,
    offset: offsetParam,
    search,
  })
  // zeroMatches now lives inside Data; filter client-side here so the API
  // contract stays the same for the admin viewer.
  const filtered = zeroOnly
    ? conversations.filter(c => c.data?.zeroMatches === true)
    : conversations

  // Card tokens store only the listing id + inline note, not the listing's
  // name or logo, so the transcript viewer can't tell which listing a card
  // actually is. Resolve the referenced ids against the catalog and ship a
  // {name, logo} lookup map alongside the conversations.
  const referencedIds = new Set<string>()
  for (const c of filtered) {
    if (!c.data) continue
    collectCardIds(c.data.response, referencedIds)
    for (const turn of c.data.history) {
      if (turn.role === 'assistant') collectCardIds(turn.content, referencedIds)
    }
    for (const id of c.data.citations) referencedIds.add(id)
    for (const id of c.clickedCitations) referencedIds.add(id)
  }

  type ListingInfo = {
    name: string
    logo?: string
    url?: string
    pageUrl?: string
  }
  const listings: Record<string, ListingInfo> = {}
  if (referencedIds.size > 0) {
    const catalog = await getCatalog()
    const byId = new Map<string, ListingInfo>()
    const byRec = new Map<string, ListingInfo>()
    for (const l of catalog.listings) {
      const info = {
        name: l.name,
        logo: l.logo,
        url: l.url,
        pageUrl: l.pageUrl,
      }
      byId.set(l.id, info)
      const rec = REC_RE.exec(l.id)?.[0]
      if (rec) byRec.set(rec, info)
    }
    for (const id of referencedIds) {
      const rec = REC_RE.exec(id)?.[0]
      const info = byId.get(id) ?? (rec ? byRec.get(rec) : undefined)
      if (info) {
        listings[id] = info
        if (rec) listings[rec] = info
      }
    }
  }

  // Fall back to the name/url snapshot stored at log time for any listing the
  // live catalog no longer has (e.g. an event deleted after it ended). Only
  // fills gaps – the live catalog wins when the listing still exists.
  for (const c of filtered) {
    for (const ref of c.data?.citationRefs ?? []) {
      if (listings[ref.id]) continue
      const info: ListingInfo = { name: ref.name, logo: ref.logo, url: ref.url }
      listings[ref.id] = info
      const rec = REC_RE.exec(ref.id)?.[0]
      if (rec && !listings[rec]) listings[rec] = info
    }
  }

  return Response.json({ conversations: filtered, listings, offset })
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
