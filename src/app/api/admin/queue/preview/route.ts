/*
  Queue card preview (sessions with the queue area only).

  POST /api/admin/queue/preview  body { id, edits? } → { kind, listing } | { kind: null }

  Reads the item's target record live, lays the page's edits over it and runs
  the resource page's own record-to-listing mapper, so the admin sees the
  card exactly as the site would build it. Read-only.
*/

import { NextRequest } from 'next/server'
import { canReviewQueue } from '@/lib/admin/auth'
import {
  getPreviewListing,
  getQueueItem,
  QueueError,
  sanitiseEdits,
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

export async function POST(req: NextRequest) {
  if (!(await canReviewQueue())) return json({ error: 'unauthorized' }, 401)
  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === 'object') {
      body = parsed as Record<string, unknown>
    }
  } catch {
    // handled below
  }
  const id = typeof body.id === 'string' ? body.id : ''
  try {
    const item = await getQueueItem(id)
    if (!item) return json({ error: 'That item no longer exists.' }, 404)
    if (!item.targetTable || !item.targetRecord) return json({ kind: null })
    const preview = await getPreviewListing(
      item.targetTable,
      item.targetRecord,
      sanitiseEdits(body.edits)
    )
    return json(preview ?? { kind: null })
  } catch (e) {
    if (e instanceof QueueError) return json({ error: e.message }, e.status)
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin-queue] preview', msg)
    return json({ error: msg }, 502)
  }
}
