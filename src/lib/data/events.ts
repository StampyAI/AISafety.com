import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblx0L8qJEaLBxJFS'
const VIEW_ID = 'viwHl72bJxCb2SfrL'

interface AirtableEventRecord {
  fields: {
    Name?: string
    Description?: string
    'Host name'?: string
    Type?: string[]
    Location?: string[]
    'Start date'?: string
    'End date'?: string
    'Length (days)'?: number
    'Applications/registrations open'?: string
    'Applications/registrations close'?: string
    'Applications open or today'?: string
    URL?: string
  }
}

const FIELDS = [
  'Name',
  'Description',
  'Host name',
  'Type',
  'Location',
  'Start date',
  'End date',
  'Length (days)',
  'Applications/registrations open',
  'Applications/registrations close',
  'Applications open or today',
  'URL',
]

export interface Event {
  id: string
  name: string
  description: string
  host: string
  types: string[]
  locations: string[]
  startDate: string | null
  endDate: string | null
  lengthDays: number | null
  applicationsClose: string | null
  registrationStatus: 'open' | 'closed' | null
  faviconUrl: string | null
  url: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function extractFaviconUrl(eventUrl: string): string | null {
  if (!eventUrl) return null
  try {
    const domain = new URL(eventUrl).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return null
  }
}

export async function getEvents(): Promise<Event[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    fields: FIELDS,
    sort: [{ field: 'Start date', direction: 'asc' }],
  })

  const today = todayISO()
  const results: Event[] = []

  for (const record of raw) {
    const fields = record.fields as AirtableEventRecord['fields']
    if (!fields.Name) continue
    if (!fields['Start date']) continue

    const startDate = fields['Start date']
    const endDate = fields['End date'] || startDate

    if (endDate < today) continue

    const closesOn = fields['Applications/registrations close'] || null
    const openOrToday = fields['Applications open or today'] || null

    let registrationStatus: 'open' | 'closed' | null = null
    if (closesOn) {
      if (!!openOrToday && openOrToday <= today && closesOn >= today) {
        registrationStatus = 'open'
      } else if (closesOn < today) {
        registrationStatus = 'closed'
      }
    }

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      host: fields['Host name'] || '',
      types: fields.Type || [],
      locations: fields.Location || [],
      startDate,
      endDate,
      lengthDays: fields['Length (days)'] ?? null,
      applicationsClose: closesOn,
      registrationStatus,
      faviconUrl: extractFaviconUrl(fields.URL || ''),
      url: fields.URL || '',
    })
  }

  return results
}
