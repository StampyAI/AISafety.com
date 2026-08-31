/*
  Change check for preview mode's auto-refresh.

  GET /api/admin/preview/changed?path=/funding&since=<ISO date>
    → { changed: boolean, now: <server time, ISO>, buildTime: <ISO | null> }

  Asks Airtable whether any record feeding that page was modified after
  `since`, via LAST_MODIFIED_TIME() — the same mechanism /api/check-rebuild
  uses to trigger deploys, so preview refreshes exactly when the pipeline
  would. The preview banner polls this a few times a minute and calls
  router.refresh() on changed:true; it passes the `now` from each response as
  the next `since`, so clock skew can't open a gap. `buildTime` is the
  BUILD_TIME of the deployment answering the poll — when it moves past the
  one the page rendered with, a rebuild has gone live and the banner
  refreshes so "public built X ago" starts over. Without `since` (the
  first poll) or for a page with no Airtable content, it reports no change —
  the caller just takes the baseline.
*/

import { NextRequest } from 'next/server'
import { canUsePreview } from '@/lib/admin/auth'
import { hasChangesSince } from '@/lib/data/changed-since'
import { resourceTables, validResources } from '@/lib/data/last-updated'

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

export async function GET(request: NextRequest) {
  if (!(await canUsePreview())) return json({ error: 'unauthorized' }, 401)

  // Taken before the Airtable queries: an edit landing while they run falls
  // after this stamp, so the next poll still reports it.
  const now = new Date().toISOString()
  const buildTime = process.env.BUILD_TIME ?? null

  const path = request.nextUrl.searchParams.get('path') ?? ''
  const resource = path.replace(/^\//, '')
  if (!validResources.includes(resource))
    return json({ changed: false, now, buildTime })

  const sinceParam = request.nextUrl.searchParams.get('since')
  if (!sinceParam) return json({ changed: false, now, buildTime })
  const since = new Date(sinceParam)
  if (isNaN(since.getTime())) {
    return json({ error: 'since must be an ISO date' }, 400)
  }

  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  // Contributor mode: no credentials, no live data to poll.
  if (!token || !baseId) return json({ changed: false, now, buildTime })

  // Sequential on purpose — same rate-limit care as everywhere else.
  let changed = false
  for (const table of resourceTables(resource)) {
    if (
      await hasChangesSince(baseId, token, table.tableId, since, table.filter)
    ) {
      changed = true
      break
    }
  }
  return json({ changed, now, buildTime })
}
