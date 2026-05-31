import { DONATION_GUIDE_LAST_UPDATED } from '@/lib/donation-guide-date'
import { formatDate } from '@/lib/format-date'
import { fetchAirtableWithRetry } from './airtable'

type QueryConfig = {
  type: 'query'
  tableId: string
  viewId?: string
  filter?: string
  sortField: string
}

type RecordConfig = {
  type: 'record'
  tableId: string
  recordId: string
  dateField: string
}

type ConstantConfig = {
  type: 'constant'
  value: string
}

type ResourceConfig = QueryConfig | RecordConfig | ConstantConfig

const configs: Record<string, ResourceConfig> = {
  events: {
    type: 'query',
    tableId: 'tblx0L8qJEaLBxJFS',
    viewId: 'viwHl72bJxCb2SfrL',
    sortField: 'Last modified',
  },
  map: {
    type: 'record',
    tableId: 'tblvzbGL9q9dOO9Nc',
    recordId: 'recvDWyM9MW9q1GUj',
    dateField: 'Description',
  },
  communities: {
    type: 'query',
    tableId: 'tbluI5Dll697WiSm8',
    filter: '{Publish?} = TRUE()',
    sortField: 'Last modified',
  },
  'self-study': {
    type: 'query',
    tableId: 'tblRNYJ0m1cmJXKKk',
    viewId: 'viwblgaia3x1gsqBo',
    sortField: 'Last modified',
  },
  jobs: {
    type: 'query',
    tableId: 'tblyLelYCQjP6w3nV',
    viewId: 'viwDXZcviPykFzt4g',
    sortField: 'Date published',
  },
  funding: {
    type: 'query',
    tableId: 'tblzMTLDZWZKqTxrq',
    filter: '{Publish?} = TRUE()',
    sortField: 'Last modified',
  },
  'media-channels': {
    type: 'query',
    tableId: 'tblCTOMzyH3vILL5I',
    filter: '{Publish?} = TRUE()',
    sortField: 'Last modified',
  },
  advisors: {
    type: 'query',
    tableId: 'tblf3KKYnmgcjVGhD',
    filter: '{Publish?} = TRUE()',
    sortField: 'Last modified',
  },
  projects: {
    type: 'query',
    tableId: 'tblHT29QNgMYKB8iW',
    filter: '{Publish?} = TRUE()',
    sortField: 'Last modified',
  },
  founders: {
    type: 'query',
    tableId: 'tbl59Ye8oxvPjoVJv',
    viewId: 'viwzMBhPBk1GpQXnn',
    filter: '{Publish?} = TRUE()',
    sortField: 'Last modified',
  },
  'donation-guide': {
    type: 'constant',
    value: DONATION_GUIDE_LAST_UPDATED,
  },
}

export const validResources = Object.keys(configs)

interface LastUpdatedResult {
  lastUpdated: string | null
  formattedDate: string | null
}

export async function fetchLastUpdated(
  resource: string
): Promise<LastUpdatedResult> {
  const config = configs[resource]
  if (!config) throw new Error(`Unknown resource: '${resource}'`)

  if (config.type === 'constant') {
    const date = new Date(config.value)
    return { lastUpdated: config.value, formattedDate: formatDate(date) }
  }

  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!token || !baseId)
    throw new Error('Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID')

  if (config.type === 'record') {
    const response = await fetchAirtableWithRetry(
      `https://api.airtable.com/v0/${baseId}/${config.tableId}/${config.recordId}`,
      token,
      { next: { revalidate: 3600 } }
    )
    if (!response.ok)
      throw new Error(
        `Airtable fetch failed for '${resource}': ${response.status} ${response.statusText}`
      )

    const record = await response.json()
    const dateStr = record.fields?.[config.dateField]
    if (!dateStr) return { lastUpdated: null, formattedDate: null }

    const date = new Date(dateStr as string)
    if (isNaN(date.getTime()))
      throw new Error(
        `Invalid date in Airtable field '${config.dateField}' for resource '${resource}': "${dateStr}"`
      )
    return {
      lastUpdated: date.toISOString(),
      formattedDate: formatDate(date),
    }
  }

  // type === 'query'
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${config.tableId}`)
  if (config.viewId) url.searchParams.set('view', config.viewId)
  if (config.filter) url.searchParams.set('filterByFormula', config.filter)
  url.searchParams.set('sort[0][field]', config.sortField)
  url.searchParams.set('sort[0][direction]', 'desc')
  url.searchParams.set('maxRecords', '1')
  url.searchParams.set('fields[]', config.sortField)

  const response = await fetchAirtableWithRetry(url.toString(), token, {
    next: { revalidate: 3600 },
  })
  if (!response.ok)
    throw new Error(
      `Airtable fetch failed for '${resource}': ${response.status} ${response.statusText}`
    )

  const data = await response.json()
  if (data.records?.length > 0) {
    const dateValue = data.records[0].fields[config.sortField]
    if (dateValue) {
      const date = new Date(dateValue as string)
      if (isNaN(date.getTime()))
        throw new Error(
          `Invalid date in Airtable field '${config.sortField}' for resource '${resource}': "${dateValue}"`
        )
      return {
        lastUpdated: date.toISOString(),
        formattedDate: formatDate(date),
      }
    }
  }

  return { lastUpdated: null, formattedDate: null }
}

// Serialized to avoid hitting Airtable's 5 req/sec rate limit.
// Called at build time (static generation) so latency doesn't matter.
export async function fetchAllLastUpdated(): Promise<
  Record<string, string | null>
> {
  const result: Record<string, string | null> = {}
  for (const name of validResources) {
    const data = await fetchLastUpdated(name)
    result[name] = data.lastUpdated
  }
  return result
}
