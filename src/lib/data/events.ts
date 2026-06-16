import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblx0L8qJEaLBxJFS'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    URL?: string
    'Start date'?: string
    'End date'?: string
    'Applications/registrations close'?: string
    Type?: string[]
    Location?: string[]
    'Host name'?: string
    'Length (days)'?: number
  }
}

export interface AISafetyEvent {
  id: string
  name: string
  description: string
  url: string
  startDate: string | null
  endDate: string | null
  applicationsClose: string | null
  type: string
  location: string
  host: string
  lengthDays: number | null
}

/** True if the event hasn't finished yet. Uses End date, falling back to Start
 *  date. Events with no dates at all (e.g. recurring programs without a
 *  scheduled instance) are kept so the bot can still reference them. */
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

export async function getEvents(): Promise<AISafetyEvent[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Start date', direction: 'asc' }],
  })

  const results: AISafetyEvent[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    const startDate = fields['Start date'] || null
    const endDate = fields['End date'] || null
    if (!isUpcomingOrOngoing(endDate, startDate)) continue

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      url: fields.URL || '#',
      startDate,
      endDate,
      applicationsClose: fields['Applications/registrations close'] || null,
      type: Array.isArray(fields.Type) ? fields.Type.join(', ') : '',
      location: Array.isArray(fields.Location)
        ? fields.Location.join(', ')
        : '',
      host: fields['Host name'] || '',
      lengthDays:
        typeof fields['Length (days)'] === 'number'
          ? fields['Length (days)']
          : null,
    })
  }

  return results
}
