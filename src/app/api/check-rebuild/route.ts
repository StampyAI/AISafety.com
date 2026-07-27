import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { fetchAirtableWithRetry } from '@/lib/data/airtable'

// Force dynamic - this endpoint must run fresh on every cron invocation
export const dynamic = 'force-dynamic'

// Airtable tables whose changes should trigger a rebuild. The filter mirrors
// what the corresponding page actually displays, so internal-only edits on
// unpublished records don't cause unnecessary rebuilds. Filters reference
// fields by permanent field ID (rename-proof).
const TABLES: Array<{
  name: string
  tableId: string
  filter?: string
}> = [
  {
    name: 'communities',
    tableId: 'tbluI5Dll697WiSm8',
    filter: '{fldV8RYP1CVzOvHpf} = TRUE()', // Publish?
  },
  {
    name: 'funding',
    tableId: 'tblzMTLDZWZKqTxrq',
    filter: '{fldoH88AbtQLEViD7} = TRUE()', // Publish?
  },
  {
    name: 'self-study',
    tableId: 'tblRNYJ0m1cmJXKKk',
    filter: '{fldWShxP7GkMeh6rg} = TRUE()', // Publish?
  },
  { name: 'map', tableId: 'tblvzbGL9q9dOO9Nc' },
  {
    name: 'advisors',
    tableId: 'tblf3KKYnmgcjVGhD',
    filter: '{fldaOmFd67ORPMfTC} = TRUE()', // Publish?
  },
  {
    name: 'projects',
    tableId: 'tblHT29QNgMYKB8iW',
    filter: '{fldrGDtZxpFLQfjMz} = TRUE()', // Publish?
  },
  {
    name: 'media-channels',
    tableId: 'tblCTOMzyH3vILL5I',
    filter: '{fldMN0TF3kz41HTQc} = TRUE()', // Publish?
  },
  {
    name: 'founders',
    tableId: 'tbl59Ye8oxvPjoVJv',
    filter: '{fld9Epdrxu9n0FV20} = TRUE()', // Publish?
  },
  {
    name: 'events',
    tableId: 'tblXbN9swwldwq8f7',
    filter: '{flddgpgNm090Uftsq} = TRUE()', // Publish?
  },
  {
    name: 'training',
    tableId: 'tbli1YSCpIuNY2DvL',
    filter: '{fldqlN36P6BVFP151} = TRUE()', // Publish?
  },
  {
    name: 'recurring-training',
    tableId: 'tblEEIbj6dW5oS4cX',
    filter: '{fldpjcvh7n6w4cIsi} = TRUE()', // Publish?
  },
]

// Module-level cooldowns prevent hammering the Vercel deploy hook. The hook is
// rate-limited (~1 per 60s) and Vercel will temporarily lock it out under spam.
// These reset on cold start, which is fine — a new instance means time has
// passed anyway.
let lastTriggerAt = 0
let lastRateLimitedAt = 0
// After a successful trigger, suppress further triggers for this long so the
// in-flight build can finish and advance BUILD_TIME.
const POST_TRIGGER_COOLDOWN_MS = 10 * 60 * 1000
// After a 429, back off entirely so we stop adding to Vercel's rate-limit count.
const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000

// Uses LAST_MODIFIED_TIME() (a formula function) rather than any table's
// "Last modified" field. The field may be configured as date-only, which
// collapses intra-day edits to midnight UTC and hides same-day changes from
// a later-that-day build. LAST_MODIFIED_TIME() always returns a full
// timestamp regardless of how the field is displayed.
async function hasChangesSince(
  baseId: string,
  token: string,
  tableId: string,
  since: Date,
  filter?: string
): Promise<boolean> {
  const sinceIso = since.toISOString()
  const timeCheck = `IS_AFTER(LAST_MODIFIED_TIME(), DATETIME_PARSE("${sinceIso}"))`
  const formula = filter ? `AND(${filter}, ${timeCheck})` : timeCheck

  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`)
  url.searchParams.set('filterByFormula', formula)
  url.searchParams.set('maxRecords', '1')

  const response = await fetchAirtableWithRetry(url.toString(), token, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Airtable fetch failed for ${tableId}: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  return (data.records?.length ?? 0) > 0
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

  // Check each table in parallel for any record modified after the build
  const results = await Promise.all(
    TABLES.map(async t => ({
      name: t.name,
      changed: await hasChangesSince(
        baseId,
        token,
        t.tableId,
        buildDate,
        t.filter
      ),
    }))
  )

  const changedTables = results.filter(r => r.changed).map(r => r.name)
  const shouldRebuild = changedTables.length > 0

  if (!shouldRebuild) {
    return NextResponse.json({
      triggered: false,
      buildTime: buildDate.toISOString(),
      changedTables: [],
    })
  }

  // Static pages get fresh data from the rebuild below, but runtime consumers
  // (assistant catalog, search index) read the shared data cache, which a
  // rebuild does not clear. Invalidate it here so they refetch on their next
  // request. Runs before the hook cooldowns on purpose: even when a rebuild
  // can't be triggered yet, runtime data should not stay stale. 'max' =
  // stale-while-revalidate; the cron re-fires every minute until the rebuild
  // lands, so the background refresh converges within a couple of requests.
  revalidateTag('airtable-records', 'max')

  const now = Date.now()

  if (now - lastTriggerAt < POST_TRIGGER_COOLDOWN_MS) {
    return NextResponse.json({
      triggered: false,
      reason: 'recent-trigger-cooldown',
      buildTime: buildDate.toISOString(),
      changedTables,
    })
  }

  if (now - lastRateLimitedAt < RATE_LIMIT_COOLDOWN_MS) {
    return NextResponse.json({
      triggered: false,
      reason: 'rate-limit-cooldown',
      buildTime: buildDate.toISOString(),
      changedTables,
    })
  }

  const hookResponse = await fetch(deployHookUrl, { method: 'POST' })

  if (hookResponse.status === 429) {
    lastRateLimitedAt = now
    console.warn(
      `Deploy hook rate-limited (429); backing off for ${RATE_LIMIT_COOLDOWN_MS / 60000} min`
    )
    return NextResponse.json({
      triggered: false,
      reason: 'rate-limited',
      buildTime: buildDate.toISOString(),
      changedTables,
    })
  }

  if (!hookResponse.ok) {
    throw new Error(
      `Deploy hook failed: ${hookResponse.status} ${hookResponse.statusText}`
    )
  }

  lastTriggerAt = now

  return NextResponse.json({
    triggered: true,
    buildTime: buildDate.toISOString(),
    changedTables,
  })
}
