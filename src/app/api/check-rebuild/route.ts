import { NextResponse } from 'next/server'

// Force dynamic - this endpoint must run fresh on every cron invocation
export const dynamic = 'force-dynamic'

// Airtable tables whose changes should trigger a rebuild. The filter mirrors
// what the corresponding page actually displays, so internal-only edits on
// unpublished records don't cause unnecessary rebuilds.
//
// Each entry queries the table sorted by the standard "Last modified" field
// and returns the most recent timestamp.
const TABLES: Array<{
  name: string
  tableId: string
  filter?: string
}> = [
  {
    name: 'communities',
    tableId: 'tbluI5Dll697WiSm8',
    filter: '{Publish?} = TRUE()',
  },
  {
    name: 'funding',
    tableId: 'tblzMTLDZWZKqTxrq',
    filter: '{Publish?} = TRUE()',
  },
  {
    name: 'self-study',
    tableId: 'tblRNYJ0m1cmJXKKk',
    filter: '{Publish?} = TRUE()',
  },
  { name: 'map', tableId: 'tblvzbGL9q9dOO9Nc' },
  {
    name: 'advisors',
    tableId: 'tblf3KKYnmgcjVGhD',
    filter: '{Publish?} = TRUE()',
  },
  {
    name: 'projects',
    tableId: 'tblHT29QNgMYKB8iW',
    filter: '{Publish?} = TRUE()',
  },
  {
    name: 'media-channels',
    tableId: 'tblCTOMzyH3vILL5I',
    filter: '{Publish?} = TRUE()',
  },
  {
    name: 'founders',
    tableId: 'tbl59Ye8oxvPjoVJv',
    filter: '{Publish?} = TRUE()',
  },
  { name: 'events', tableId: 'tblx0L8qJEaLBxJFS' },
]

async function fetchLastModified(
  baseId: string,
  token: string,
  tableId: string,
  filter?: string
): Promise<Date | null> {
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`)
  if (filter) url.searchParams.set('filterByFormula', filter)
  url.searchParams.set('sort[0][field]', 'Last modified')
  url.searchParams.set('sort[0][direction]', 'desc')
  url.searchParams.set('maxRecords', '1')
  url.searchParams.set('fields[]', 'Last modified')

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Airtable fetch failed for ${tableId}: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  const record = data.records?.[0]
  if (!record) return null

  const dateStr = record.fields?.['Last modified']
  if (!dateStr) return null

  const date = new Date(dateStr as string)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid "Last modified" date for ${tableId}: "${dateStr}"`)
  }
  return date
}

export async function GET(request: Request) {
  // Vercel cron jobs include this auth header automatically
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL
  const buildTime = process.env.BUILD_TIME

  if (!token || !baseId) {
    return NextResponse.json(
      { error: 'Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID' },
      { status: 500 }
    )
  }
  if (!deployHookUrl) {
    return NextResponse.json(
      { error: 'Missing VERCEL_DEPLOY_HOOK_URL' },
      { status: 500 }
    )
  }
  if (!buildTime) {
    return NextResponse.json(
      { error: 'Missing BUILD_TIME (check next.config.ts)' },
      { status: 500 }
    )
  }

  const buildDate = new Date(buildTime)

  // Fetch max Last modified for every table in parallel
  const results = await Promise.all(
    TABLES.map(async t => ({
      name: t.name,
      lastModified: await fetchLastModified(baseId, token, t.tableId, t.filter),
    }))
  )

  let maxDate: Date | null = null
  let maxTable: string | null = null
  for (const r of results) {
    if (r.lastModified && (!maxDate || r.lastModified > maxDate)) {
      maxDate = r.lastModified
      maxTable = r.name
    }
  }

  const shouldRebuild = maxDate !== null && maxDate > buildDate

  if (!shouldRebuild) {
    return NextResponse.json({
      triggered: false,
      buildTime: buildDate.toISOString(),
      latestChange: maxDate?.toISOString() ?? null,
      latestTable: maxTable,
    })
  }

  const hookResponse = await fetch(deployHookUrl, { method: 'POST' })
  if (!hookResponse.ok) {
    throw new Error(
      `Deploy hook failed: ${hookResponse.status} ${hookResponse.statusText}`
    )
  }

  return NextResponse.json({
    triggered: true,
    buildTime: buildDate.toISOString(),
    latestChange: maxDate?.toISOString(),
    latestTable: maxTable,
  })
}
