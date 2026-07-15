import {
  fetchAirtableRecords,
  fieldNumber,
  fieldString,
  fieldText,
  publishedFormula,
} from './airtable'

const TABLE_ID = 'tblx0L8qJEaLBxJFS'

// Permanent Airtable field IDs for the legacy Events & training table.
// Fetching, filtering and sorting by ID keeps this working when fields
// are renamed.
const FIELD = {
  name: 'fldqx8bjKAUc3IfVO', // Name
  description: 'fldKQrII3tnj8K2xT', // Description
  url: 'fld6fSumOLa0mCl62', // URL
  startDate: 'fldRdvrU4kw7liuXt', // Start date
  endDate: 'fld9viXAgNWmLmcwO', // End date
  applicationsClose: 'fldiDBF0GlZkxepBx', // Applications/registrations close
  type: 'fldu75bm9xmXRJ9NU', // Type
  location: 'fldK8ohHmfjK1N7dY', // Location
  hostName: 'fldv4uOpBaUOO1CR3', // Host name
  lengthDays: 'fldmzcZShTVzvZ1js', // Length (days)
  publish: 'fldttLEJht7oFgNDX', // Publish?
  hide: 'fldxeTQM7GTOmBY7n', // Hide?
} as const

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
    returnFieldsByFieldId: true,
    filterByFormula: publishedFormula(FIELD.publish, FIELD.hide),
    sort: [{ field: FIELD.startDate, direction: 'asc' }],
  })

  const results: AISafetyEvent[] = []
  for (const record of raw) {
    const f = record.fields
    const name = fieldString(f[FIELD.name])
    if (!name) continue

    const startDate = fieldString(f[FIELD.startDate])
    const endDate = fieldString(f[FIELD.endDate])
    if (!isUpcomingOrOngoing(endDate, startDate)) continue

    results.push({
      id: record.id,
      name,
      description: fieldString(f[FIELD.description]) || '',
      url: fieldString(f[FIELD.url]) || '#',
      startDate,
      endDate,
      applicationsClose: fieldString(f[FIELD.applicationsClose]),
      type: fieldText(f[FIELD.type]),
      location: fieldText(f[FIELD.location]),
      host: fieldString(f[FIELD.hostName]) || '',
      lengthDays: fieldNumber(f[FIELD.lengthDays]),
    })
  }

  return results
}
