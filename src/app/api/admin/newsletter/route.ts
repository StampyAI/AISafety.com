/*
  Newsletter approval API (owner-password sessions only — canSendNewsletter).

  GET  /api/admin/newsletter   → { fetchedAt, drafts, recent }
                                  drafts = pipeline-made draft campaigns with
                                  their verification result; recent = latest
                                  sends/scheduled campaigns
  POST /api/admin/newsletter   → body { campaign, list }
                                  re-verifies the draft, schedules it to send
                                  in ~2 minutes, deletes the draft shell
                               → { campaign, sdate, listName, activeContacts }
                                  409 with { problems } when verification fails
*/

import { NextRequest } from 'next/server'
import { canSendNewsletter } from '@/lib/admin/auth'
import {
  approveAndSend,
  DraftProblemError,
  isNewsletterConfigured,
  listDrafts,
  listRecent,
} from '@/lib/admin/newsletter'

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
  if (!(await canSendNewsletter())) return json({ error: 'unauthorized' }, 401)
  if (!isNewsletterConfigured()) {
    return json(
      { error: 'ACTIVECAMPAIGN_URL / ACTIVECAMPAIGN_KEY not set' },
      503
    )
  }
  return null
}

export async function GET() {
  const auth = await ensureAuth()
  if (auth) return auth
  try {
    const [drafts, recent] = await Promise.all([listDrafts(), listRecent()])
    return json({ fetchedAt: new Date().toISOString(), drafts, recent })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[newsletter] list failed: ${message}`)
    return json({ error: message }, 502)
  }
}

export async function POST(req: NextRequest) {
  const auth = await ensureAuth()
  if (auth) return auth
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body must be JSON' }, 400)
  }
  const { campaign, list } = (body ?? {}) as {
    campaign?: unknown
    list?: unknown
  }
  const campaignId = String(campaign ?? '')
  const listId = String(list ?? '')
  if (!/^\d+$/.test(campaignId) || !/^\d+$/.test(listId)) {
    return json({ error: 'body must be { campaign: id, list: id }' }, 400)
  }
  try {
    const result = await approveAndSend(campaignId, listId)
    return json(result)
  } catch (err) {
    if (err instanceof DraftProblemError) {
      return json({ error: err.message, problems: err.problems }, 409)
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[newsletter] approve ${campaignId} failed: ${message}`)
    return json({ error: message }, 502)
  }
}
