/*
  Preview mode toggle.

  POST /api/admin/preview  → body { enabled: boolean }
                             sets or clears the Draft Mode cookie on THIS
                             browser only, then returns { enabled }
                           → body { pills: boolean }
                             shows or hides the floating switch pills on THIS
                             browser (the /admin/preview master switch), then
                             returns { pills }

  Turning preview on (and showing the pills) requires a listing-editing
  password (canUsePreview) — with the draft cookie set, every page this
  browser loads is rendered on demand from live Airtable data. Turning
  either off is deliberately unauthenticated: it only clears the caller's
  own cookie, and a session whose admin login has expired must still be able
  to leave preview mode.
*/

import { NextRequest } from 'next/server'
import { draftMode } from 'next/headers'
import { canUsePreview, setPreviewPillsCookie } from '@/lib/admin/auth'

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

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'body must be JSON' }, 400)
  }
  const { enabled, pills } = (body ?? {}) as {
    enabled?: unknown
    pills?: unknown
  }

  if (typeof pills === 'boolean') {
    if (pills && !(await canUsePreview())) {
      return json({ error: 'unauthorized' }, 401)
    }
    await setPreviewPillsCookie(pills)
    return json({ pills })
  }

  if (typeof enabled !== 'boolean') {
    return json(
      { error: 'body must be { enabled: boolean } or { pills: boolean }' },
      400
    )
  }

  const dm = await draftMode()
  if (enabled) {
    if (!(await canUsePreview())) return json({ error: 'unauthorized' }, 401)
    dm.enable()
  } else {
    dm.disable()
  }
  return json({ enabled })
}
