import { fetchAirtableRecords } from './airtable'
import { EVENT_TYPES, type EventType } from '../event-types'
import { parseAttendMode, type AttendMode } from './training'

const TABLE_ID = 'tblXbN9swwldwq8f7'
const VIEW_ID: string | undefined = undefined

// Permanent Airtable field IDs for the Events table. Fetching by ID
// (returnFieldsByFieldId) keeps the page working when fields are renamed
// in Airtable.
const FIELD = {
  name: 'fldHDwWtiBFYN9fgf',
  description: 'fldAdLfIFJlJYD3Fm',
  url: 'fldvCJ4pBXAxxSWRo',
  type: 'fldF03SyCeA0aM68n',
  online: 'fldaCB147ky62Cb83',
  mode: 'fldDGWhpZDJQEGf8Q',
  startDate: 'fldsDuvoXahPLGYEN',
  endDate: 'fldAAtwTu3POfROpi',
  deadline: 'fldRhQqHVTVvGFM3k',
  deadlineType: 'fldkz9cW2FkG8xHac',
  notYetOpen: 'fldF96eidqxAMF08c',
  location: 'fldqvyFLWjImT4n1y',
  logo: 'fldYAG5RVeT6FbSHa',
  host: 'fldNKTGHFtf4EptQ7',
  cost: 'fldcgDGeUkOAFdnWg',
  featured: 'fldPlLRAopKjDlSEV',
  featuredTagline: 'fld2rzRd4asMe18aQ',
  publish: 'flddgpgNm090Uftsq',
  hide: 'fldsYr7bsZb3eCPum',
  lastModified: 'fldB3qONkXobywxmp',
} as const

export interface EventListing {
  id: string
  dateAdded: string | null
  lastModified: string | null
  name: string
  description: string
  url: string
  type: string[]
  location: string
  mode: AttendMode
  startDate: string | null
  endDate: string | null
  startTime: string | null
  endTime: string | null
  host: string
  cost: string[]
  applicationStatus: 'Open' | 'Closed'
  applicationsClose: string | null
  /** Announced but not yet accepting applications (outranks the deadline). */
  notYetOpen: boolean
  deadlineType: 'Apply' | 'Register' | null
  logo: string | null
  featured: '1' | '2' | null
  featuredTagline: string | null
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function toArray(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  return []
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

  // Publish/Hide filtering and date sorting happen in code below rather than
  // in the Airtable query — filterByFormula and sort reference fields by
  // name, which would break when a field is renamed.
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    returnFieldsByFieldId: true,
  })

  const today = new Date().toISOString().slice(0, 10)
  const results: EventListing[] = []

  for (const record of raw) {
    const f = record.fields
    const name = optionalString(f[FIELD.name])
    if (!name) continue
    if (f[FIELD.publish] !== true || f[FIELD.hide] === true) continue

    const startDate = optionalString(f[FIELD.startDate])
    const endDate = optionalString(f[FIELD.endDate])
    if (!isUpcomingOrOngoing(endDate, startDate)) continue

    const rawTypes = toArray(f[FIELD.type])
    for (const t of rawTypes) {
      if (!EVENT_TYPES.includes(t as EventType)) {
        console.warn(
          `[events] "${name}" has unexpected Type "${t}" ` +
            `(allowed: ${EVENT_TYPES.join(', ')})`
        )
      }
    }
    const type = rawTypes.filter(t => EVENT_TYPES.includes(t as EventType))

    const location = toArray(f[FIELD.location]).join(', ')
    const mode = parseAttendMode(
      f[FIELD.mode],
      f[FIELD.online],
      location,
      name,
      'events'
    )

    // No close date means there is nothing to apply/register for, so the
    // event counts as open — unless applications/registrations haven't
    // opened yet, which outranks any deadline (orgs sometimes announce the
    // deadline before opening). See the field descriptions on the Events
    // table.
    const closesOn = optionalString(f[FIELD.deadline])
    const notYetOpen = f[FIELD.notYetOpen] === true
    const applicationStatus: 'Open' | 'Closed' =
      !notYetOpen && (!closesOn || closesOn >= today) ? 'Open' : 'Closed'

    const rawDeadlineType = optionalString(f[FIELD.deadlineType])
    const deadlineType =
      rawDeadlineType === 'Apply' || rawDeadlineType === 'Register'
        ? rawDeadlineType
        : null
    if (rawDeadlineType && !deadlineType) {
      console.warn(
        `[events] "${name}" has unexpected Deadline type "${rawDeadlineType}" (allowed: Apply, Register)`
      )
    }
    if (deadlineType && !closesOn && !notYetOpen) {
      console.warn(
        `[events] "${name}" has a Deadline type but no deadline date — no deadline will be shown`
      )
    }

    const logoField = f[FIELD.logo] as Array<{ url?: string }> | undefined
    const featuredRaw = f[FIELD.featured]

    results.push({
      id: record.id,
      dateAdded: record.createdTime?.slice(0, 10) ?? null,
      lastModified: optionalString(f[FIELD.lastModified])?.slice(0, 10) ?? null,
      name,
      description: optionalString(f[FIELD.description]) || '',
      url: normalizeUrl(optionalString(f[FIELD.url]) || ''),
      type,
      location,
      mode,
      startDate,
      endDate,
      // The Events table has no time fields yet.
      startTime: null,
      endTime: null,
      host: optionalString(f[FIELD.host]) || '',
      cost: toArray(f[FIELD.cost]),
      applicationStatus,
      applicationsClose: closesOn,
      notYetOpen,
      deadlineType,
      logo: logoField?.[0]?.url ?? null,
      featured: featuredRaw === '1' || featuredRaw === '2' ? featuredRaw : null,
      featuredTagline: optionalString(f[FIELD.featuredTagline]),
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
