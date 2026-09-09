/*
  Queue API (sessions with the queue area only).

  GET  /api/admin/queue                        → { items }
  GET  /api/admin/queue?target=<tbl>/<rec>     → { fields, schema } (live)
  POST /api/admin/queue  body { id, action, edits?, reason?, note? } → { item }
       action: accept | reject | revise | undo

  Every accept writes to the live base, so the route re-reads the row first
  and refuses anything already decided (409). No fresh-session requirement:
  an accept is no more dangerous than a map-editor save, and the point of
  the page is one click.
*/

import { NextRequest } from 'next/server'
import { canReviewQueue, currentAdmin } from '@/lib/admin/auth'
import {
  acceptItem,
  getQueueItem,
  getTableSchema,
  getTargetFields,
  listQueue,
  QueueError,
  rejectItem,
  reviseItem,
  sanitiseEdits,
  undoItem,
} from '@/lib/admin/queue'

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

async function ensureAuth(): Promise<Response | null> {
  if (!(await canReviewQueue())) return json({ error: 'unauthorized' }, 401)
  return null
}

function failure(e: unknown): Response {
  if (e instanceof QueueError) return json({ error: e.message }, e.status)
  const msg = e instanceof Error ? e.message : String(e)
  console.error('[admin-queue]', msg)
  return json({ error: msg }, 502)
}

export async function GET(req: NextRequest) {
  const auth = await ensureAuth()
  if (auth) return auth
  try {
    const target = req.nextUrl.searchParams.get('target')
    if (target) {
      const [table = '', record = ''] = target.split('/')
      const [fields, schema] = await Promise.all([
        getTargetFields(table, record),
        getTableSchema(table),
      ])
      if (!fields) return json({ error: 'That record no longer exists.' }, 404)
      return json({ fields, schema })
    }
    return json({ items: await listQueue() })
  } catch (e) {
    return failure(e)
  }
}

const ACTIONS = new Set(['accept', 'reject', 'revise', 'undo'])

export async function POST(req: NextRequest) {
  const auth = await ensureAuth()
  if (auth) return auth
  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === 'object') {
      body = parsed as Record<string, unknown>
    }
  } catch {
    // empty body: handled below
  }
  const id = typeof body.id === 'string' ? body.id : ''
  const action = typeof body.action === 'string' ? body.action : ''
  if (!ACTIONS.has(action)) return json({ error: 'unknown action' }, 400)
  try {
    const item = await getQueueItem(id)
    if (!item) return json({ error: 'That item no longer exists.' }, 404)
    const me = await currentAdmin()
    if (action === 'accept') {
      await acceptItem(item, sanitiseEdits(body.edits))
    } else if (action === 'reject') {
      await rejectItem(item, typeof body.reason === 'string' ? body.reason : '')
    } else if (action === 'revise') {
      await reviseItem(item, typeof body.note === 'string' ? body.note : '')
    } else {
      await undoItem(item)
    }
    console.log(
      `[admin-queue] ${action} ${item.type} ${item.id} "${item.title}" by ${me?.name ?? me?.email ?? '?'}`
    )
    return json({ item: await getQueueItem(id) })
  } catch (e) {
    return failure(e)
  }
}
