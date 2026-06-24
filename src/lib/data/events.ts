import { fetchAirtableRecords } from './airtable'
import { EVENT_TYPES, type EventType } from '../event-types'

const TABLE_ID = ''
const VIEW_ID: string | undefined = undefined

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    URL?: string
    Type?: string | string[]
    Location?: string | string[]
    'Online?'?: boolean
    'Start date'?: string
    'End date'?: string
    'Start time'?: string
    'End time'?: string
    'Applications open or today'?: string
    'Applications/registrations close'?: string
    'Host name'?: string
    Cost?: string | string[]
    Logo?: Array<{ url: string }>
    Featured?: string
    'Featured tagline'?: string
  }
}

export interface EventListing {
  id: string
  name: string
  description: string
  url: string
  type: string[]
  location: string
  isOnline: boolean
  startDate: string | null
  endDate: string | null
  startTime: string | null
  endTime: string | null
  host: string
  cost: string[]
  applicationStatus: 'Open' | 'Closed'
  logo: string | null
  featured: '1' | '2' | null
  featuredTagline: string | null
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return '#'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isUpcomingOrOngoing(
  endDate: string | null,
  startDate: string | null
): boolean {
  const effectiveEnd = endDate || startDate
  if (!effectiveEnd) return true
  const end = new Date(effectiveEnd + 'T23:59:59Z').getTime()
  if (Number.isNaN(end)) return true
  return end >= Date.now()
}

export async function getEvents(): Promise<EventListing[]> {
  if (process.env.EVENTS_USE_MOCK === 'true') {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    return JSON.parse(
      readFileSync(join(process.cwd(), 'events.mock.json'), 'utf8')
    ) as EventListing[]
  }

  if (!TABLE_ID) {
    console.warn(
      '[events] TABLE_ID is not configured — returning no events. Set it in src/lib/data/events.ts once the dedicated Events table is available.'
    )
    return []
  }

  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Start date', direction: 'asc' }],
  })

  const today = new Date().toISOString().slice(0, 10)
  const results: EventListing[] = []

  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    const startDate = fields['Start date'] || null
    const endDate = fields['End date'] || null
    if (!isUpcomingOrOngoing(endDate, startDate)) continue

    const rawTypes = toArray(fields.Type)
    for (const t of rawTypes) {
      if (!EVENT_TYPES.includes(t as EventType)) {
        console.warn(
          `[events] "${fields.Name}" has unexpected Type "${t}" ` +
            `(allowed: ${EVENT_TYPES.join(', ')})`
        )
      }
    }
    const type = rawTypes.filter(t => EVENT_TYPES.includes(t as EventType))

    const location = Array.isArray(fields.Location)
      ? fields.Location.join(', ')
      : fields.Location || ''
    const isOnline =
      fields['Online?'] === true || location.trim().toLowerCase() === 'online'

    const opensOn = fields['Applications open or today']
    const closesOn = fields['Applications/registrations close']
    const applicationStatus: 'Open' | 'Closed' =
      !!opensOn && !!closesOn && opensOn <= today && closesOn >= today
        ? 'Open'
        : 'Closed'

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      url: normalizeUrl(fields.URL || ''),
      type,
      location,
      isOnline,
      startDate,
      endDate,
      startTime: fields['Start time'] || null,
      endTime: fields['End time'] || null,
      host: fields['Host name'] || '',
      cost: toArray(fields.Cost),
      applicationStatus,
      logo: fields.Logo?.[0]?.url ?? null,
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  results.sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return a.startDate.localeCompare(b.startDate)
  })

  return results
}
