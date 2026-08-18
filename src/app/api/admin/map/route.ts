/*
  Admin map editor API.

  GET  /api/admin/map      → { fetchedAt, records }  (live Airtable read,
                             published + unpublished, Hide? excluded)
  PATCH /api/admin/map     → body { id, x, y, expected? }
                             writes ONLY x and y on that record

  Owner-password sessions only (canEditMap). Never revalidates any cache or
  path: the public /map keeps refreshing on its own schedule.
*/

import { NextRequest } from 'next/server'
import { canEditMap } from '@/lib/admin/auth'
import {
  getMapPosition,
  isMapEditorConfigured,
  listMapRecordsLive,
  updateMapPosition,
} from '@/lib/admin/map-editor'
import {
  samePosition,
  validateMoveBody,
  ValidationError,
} from '@/lib/admin/map-editor-core'

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
  if (!(await canEditMap())) return json({ error: 'unauthorized' }, 401)
  if (!isMapEditorConfigured()) {
    return json({ error: 'AIRTABLE_TOKEN / AIRTABLE_BASE_ID not set' }, 503)
  }
  return null
}

export async function GET() {
  const auth = await ensureAuth()
  if (auth) return auth
  try {
    const records = await listMapRecordsLive()
    return json({ fetchedAt: new Date().toISOString(), records })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[map-editor] list failed: ${message}`)
    return json({ error: message }, 502)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAuth()
  if (auth) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body must be JSON' }, 400)
  }

  let move
  try {
    move = validateMoveBody(body)
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: err.message }, 400)
    throw err
  }

  try {
    const current = await getMapPosition(move.id)
    if (current === null) return json({ error: 'record not found' }, 404)

    if (move.expected && !samePosition(current, move.expected)) {
      return json({ error: 'stale', current }, 409)
    }

    const stored = await updateMapPosition(move.id, move.x, move.y)
    console.info(
      `[map-editor] ${move.id}: (${current.x}, ${current.y}) → (${stored.x}, ${stored.y})`
    )
    return json({ record: { id: move.id, ...stored } })
  } catch (err) {
    // Airtable read/write problems come back to the editor as a visible
    // error (never swallowed); the details go to the server log too.
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[map-editor] move failed for ${move.id}: ${message}`)
    // Airtable's rate limit (5 req/s per base, then a ~30 s lockout) comes
    // back as 429 so the editor can wait and retry rather than give up.
    const rateLimited = /\b429\b/.test(message) && /RATE_LIMIT/.test(message)
    return json({ error: message }, rateLimited ? 429 : 502)
  }
}
