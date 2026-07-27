import { NextResponse } from 'next/server'
import { checkCatalogCoverage } from '@/lib/assistant/catalog-coverage'

// Daily cron. Verifies every Airtable table in the base is accounted for in the
// chatbot catalog registry (RESOURCE_TABLES) or the internal denylist. Catches
// the failure mode where a new resource table is added but never wired into the
// assistant, so the bot silently can't see it.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Vercel cron jobs include this auth header automatically.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!token || !baseId) {
    return NextResponse.json(
      { error: 'Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID' },
      { status: 500 }
    )
  }

  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Airtable meta API failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`
    )
  }

  const data = (await res.json()) as {
    tables?: { id: string; name: string }[]
  }
  const liveTables = (data.tables ?? []).map(t => ({ id: t.id, name: t.name }))

  const { ok, issues } = checkCatalogCoverage(liveTables)

  if (!ok) {
    // Surfaces in Vercel logs / observability so a gap is visible without
    // anyone hitting this endpoint manually.
    console.error(
      `[check-catalog] ${issues.length} coverage issue(s):\n- ${issues.join('\n- ')}`
    )
  }

  return NextResponse.json({ ok, issues, tableCount: liveTables.length })
}
