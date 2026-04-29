import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblx0L8qJEaLBxJFS'
const VIEW_ID = 'viwHl72bJxCb2SfrL'

// NOTE: Field names below are conventional guesses based on patterns from
// other resource fetchers (jobs, communities, funding). Verify against the
// actual Airtable schema and adjust if any field name is different.
interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    'Event type'?: string | string[]
    Location?: string | string[]
    Format?: string | string[]
    Cost?: string | string[]
    'Application status'?: string
    'Start date'?: string
    'End date'?: string
    'Application deadline'?: string
    URL?: string
    Image?: Array<{ url: string }>
    Featured?: boolean
  }
}

export interface EventListing {
  id: string
  name: string
  description: string
  type: string[]
  location: string
  format: string[]
  cost: string[]
  applicationStatus: string
  startDate: string | null
  endDate: string | null
  applicationDeadline: string | null
  url: string
  image: string | null
  featured: boolean
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export async function getEvents(): Promise<EventListing[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
  })

  const results: EventListing[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    let image: string | null = null
    if (fields.Image && fields.Image.length > 0) {
      image = fields.Image[0].url
    }

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      type: toArray(fields['Event type']),
      location: Array.isArray(fields.Location)
        ? fields.Location.join(', ')
        : fields.Location || '',
      format: toArray(fields.Format),
      cost: toArray(fields.Cost),
      applicationStatus: fields['Application status'] || '',
      startDate: fields['Start date'] || null,
      endDate: fields['End date'] || null,
      applicationDeadline: fields['Application deadline'] || null,
      url: fields.URL || '#',
      image,
      featured: fields.Featured === true,
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
