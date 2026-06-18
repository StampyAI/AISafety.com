import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblx0L8qJEaLBxJFS'
const VIEW_ID = 'viwHl72bJxCb2SfrL'

// Public field allowlist: only fields safe to expose publicly are fetched.
const FIELDS = [
  'Name',
  'Description',
  'Type',
  'Location',
  'Host name',
  'Start date',
  'End date',
  'Applications/registrations close',
  'Length (days)',
  'Link',
  'URL',
]

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    Type?: string[]
    Location?: string[]
    'Host name'?: string
    'Start date'?: string
    'End date'?: string
    'Applications/registrations close'?: string
    'Length (days)'?: number
    // 'Link' is an Airtable button field: { label, url }. 'URL' is a plain
    // string fallback that mirrors the button's target.
    Link?: { label?: string; url?: string } | string
    URL?: string
  }
}

export interface Event {
  id: string
  name: string
  description: string
  type: string
  location: string
  host: string
  startDate: string | null
  endDate: string | null
  registrationCloses: string | null
  lengthDays: number | null
  url: string
}

export async function getEvents(): Promise<Event[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    filterByFormula: '{Publish?} = TRUE()',
    fields: FIELDS,
  })

  const results: Event[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    let url = '#'
    const link = fields.Link
    if (link && typeof link === 'object' && link.url) {
      url = link.url
    } else if (typeof link === 'string' && link) {
      url = link
    } else if (fields.URL) {
      url = fields.URL
    }

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      type: Array.isArray(fields.Type) ? fields.Type.join(', ') : '',
      location: Array.isArray(fields.Location)
        ? fields.Location.join(', ')
        : '',
      host: fields['Host name'] || '',
      startDate: fields['Start date'] || null,
      endDate: fields['End date'] || null,
      registrationCloses: fields['Applications/registrations close'] || null,
      lengthDays:
        typeof fields['Length (days)'] === 'number'
          ? fields['Length (days)']
          : null,
      url,
    })
  }

  return results
}
