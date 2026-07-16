import { NextResponse } from 'next/server'
import { isOwner } from '@/lib/admin/auth'
import { refreshQuestionThemes } from '@/lib/analytics/themes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The refresh makes one Claude call over every typed question — give it room.
export const maxDuration = 60

async function refresh(): Promise<Response> {
  try {
    const summary = await refreshQuestionThemes()
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[analytics] theme refresh failed: ${message}`)
    return new Response(`Theme refresh failed: ${message}`, { status: 500 })
  }
}

/** The dashboard's owner-only Refresh button. */
export async function POST() {
  if (!(await isOwner())) {
    return new Response('Unauthorized', { status: 401 })
  }
  return refresh()
}

/** The weekly Vercel cron (see vercel.json). Same auth pattern as the other
 *  cron routes: enforced only when CRON_SECRET is configured. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  return refresh()
}
