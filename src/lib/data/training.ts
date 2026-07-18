import { fetchAirtableRecords } from './airtable'
import {
  ENTRY_BARS,
  TRAINING_TYPES,
  type EntryBar,
  type LengthBucket,
  type TrainingType,
} from '../training-types'

// The redesigned /training page reads from two tables: "Training" holds
// dated upcoming iterations, "Recurring training" holds evergreen programs
// that run repeatedly (shown under the Recurring toggle, without dates).
const TRAINING_TABLE_ID = 'tbli1YSCpIuNY2DvL'
const RECURRING_TABLE_ID = 'tblEEIbj6dW5oS4cX'

// Permanent Airtable field IDs (returnFieldsByFieldId), rename-proof.
const TRAINING_FIELD = {
  name: 'fldNq08J2QqQ8SreD',
  logo: 'fldlVUH5xZ7sNGv0j',
  description: 'fldIRngvk0vjSwjh8',
  url: 'fld1dv9ed8uwiaHh4',
  type: 'fldYhxEyLrNOBWIpY',
  online: 'fld3mfwdhbXgLiIhs',
  startDate: 'fldQ173rUHJa5MHiA',
  endDate: 'fld7Ec5O8m71oZV44',
  deadline: 'fldoBOQpi5ZC6TnwU',
  notYetOpen: 'fldEJLrVPCpawJ6vU',
  location: 'fldbXDQcn21eXLIsj',
  host: 'fldZkYuamVgx1fFRB',
  featured: 'fldohjDIPWGdaYbde',
  featuredTagline: 'fldEAM4accKaYHkXk',
  publish: 'fldqlN36P6BVFP151',
  hide: 'flddDc88G07fcDQu4',
  focus: 'fldvXetgmH68KXi64',
  entryBar: 'fldNGM0Z7xQciYeDW',
  timeCommitment: 'fld55R10v0Pz6Gaxp',
  stipend: 'fldttliZeFMxWW9Hb',
} as const

const RECURRING_FIELD = {
  name: 'fld2ujguXgAB0VIuH',
  logo: 'fld4prSjzf1grRz8g',
  description: 'fldmxKtipDTvG4mes',
  url: 'flda40IiCohiSbKoq',
  type: 'fld86l7WsvLm8jm86',
  online: 'flduUmcLQ4nsMQpwQ',
  location: 'fld3wvi1BIj2QSXMV',
  host: 'fldaQgHIMc3RqnFqv',
  featured: 'fldonn5EmegA4Yqlf',
  featuredTagline: 'fld6KoNRkePsz28ov',
  publish: 'fldpjcvh7n6w4cIsi',
  hide: 'fldnYj4lieZlkXjWB',
  focus: 'fld1yyUL3BM0KQw8l',
  entryBar: 'fld1FGDbT7BJpY7Vi',
  timeCommitment: 'fldU91KGSj2APdDRq',
  stipend: 'fldoHJPQyRJUA8gap',
} as const

// Card fields shared by upcoming and recurring programs.
export interface ProgramBase {
  id: string
  name: string
  description: string
  url: string
  type: string[]
  location: string
  isOnline: boolean
  host: string
  focus: string | null
  entryBar: EntryBar | null
  timeCommitment: string | null
  stipend: string | null
  logo: string | null
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export interface TrainingProgram extends ProgramBase {
  startDate: string | null
  endDate: string | null
  applicationStatus: 'Open' | 'Closed'
  applicationsClose: string | null
  /** Announced but not yet accepting applications (outranks the deadline). */
  notYetOpen: boolean
  lengthBucket: LengthBucket | null
}

export type RecurringProgram = ProgramBase

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

function lengthBucketFor(
  startDate: string | null,
  endDate: string | null
): LengthBucket | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate + 'T00:00:00Z').getTime()
  const end = new Date(endDate + 'T00:00:00Z').getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  const days = Math.round((end - start) / 86_400_000) + 1
  if (days < 30) return 'Under 1 month'
  if (days <= 92) return '1–3 months'
  return '3+ months'
}

function validEntryBar(value: unknown, name: string): EntryBar | null {
  const raw = optionalString(value)
  if (!raw) return null
  if ((ENTRY_BARS as readonly string[]).includes(raw)) return raw as EntryBar
  console.warn(
    `[training] "${name}" has unexpected Entry bar "${raw}" (allowed: ${ENTRY_BARS.join(', ')})`
  )
  return null
}

function validTypes(value: unknown, name: string): string[] {
  const rawTypes = toArray(value)
  for (const t of rawTypes) {
    if (!TRAINING_TYPES.includes(t as TrainingType)) {
      console.warn(
        `[training] "${name}" has unexpected Type "${t}" ` +
          `(allowed: ${TRAINING_TYPES.join(', ')})`
      )
    }
  }
  return rawTypes.filter(t => TRAINING_TYPES.includes(t as TrainingType))
}

interface BaseFieldIds {
  name: string
  logo: string
  description: string
  url: string
  type: string
  online: string
  location: string
  host: string
  featured: string
  featuredTagline: string
  focus: string
  entryBar: string
  timeCommitment: string
  stipend: string
}

function parseBase(
  fields: Record<string, unknown>,
  id: string,
  name: string,
  FIELD: BaseFieldIds
): ProgramBase {
  const location = optionalString(fields[FIELD.location]) || ''
  const isOnline =
    fields[FIELD.online] === true || location.trim().toLowerCase() === 'online'
  const logoField = fields[FIELD.logo] as Array<{ url?: string }> | undefined
  const featuredRaw = fields[FIELD.featured]

  return {
    id,
    name,
    description: optionalString(fields[FIELD.description]) || '',
    url: normalizeUrl(optionalString(fields[FIELD.url]) || ''),
    type: validTypes(fields[FIELD.type], name),
    location,
    isOnline,
    host: optionalString(fields[FIELD.host]) || '',
    focus: optionalString(fields[FIELD.focus]),
    entryBar: validEntryBar(fields[FIELD.entryBar], name),
    timeCommitment: optionalString(fields[FIELD.timeCommitment]),
    stipend: optionalString(fields[FIELD.stipend]),
    logo: logoField?.[0]?.url ?? null,
    featured: featuredRaw === '1' || featuredRaw === '2' ? featuredRaw : null,
    featuredTagline: optionalString(fields[FIELD.featuredTagline]),
  }
}

export async function getTrainingPrograms(): Promise<TrainingProgram[]> {
  // Publish/Hide filtering and sorting happen in code below rather than in
  // the Airtable query — filterByFormula and sort reference fields by name,
  // which would break when a field is renamed.
  const raw = await fetchAirtableRecords({
    tableId: TRAINING_TABLE_ID,
    returnFieldsByFieldId: true,
  })

  const today = new Date().toISOString().slice(0, 10)
  const results: TrainingProgram[] = []

  for (const record of raw) {
    const f = record.fields
    const name = optionalString(f[TRAINING_FIELD.name])
    if (!name) continue
    if (f[TRAINING_FIELD.publish] !== true || f[TRAINING_FIELD.hide] === true)
      continue

    const startDate = optionalString(f[TRAINING_FIELD.startDate])
    const endDate = optionalString(f[TRAINING_FIELD.endDate])
    if (!isUpcomingOrOngoing(endDate, startDate)) continue

    // A program leaves the page once its application deadline has passed
    // (agreed with Melissa, July 2026) — deadline-less programs stay until
    // they end.
    const closesOn = optionalString(f[TRAINING_FIELD.deadline])
    if (closesOn && closesOn < today) continue

    // No close date means applications are open-ended — unless applications
    // haven't opened yet, which outranks any deadline (orgs sometimes
    // announce the deadline before opening). See the field descriptions on
    // the Training table.
    const notYetOpen = f[TRAINING_FIELD.notYetOpen] === true
    const applicationStatus: 'Open' | 'Closed' =
      !notYetOpen && (!closesOn || closesOn >= today) ? 'Open' : 'Closed'

    results.push({
      ...parseBase(f, record.id, name, TRAINING_FIELD),
      startDate,
      endDate,
      applicationStatus,
      applicationsClose: closesOn,
      notYetOpen,
      lengthBucket: lengthBucketFor(startDate, endDate),
    })
  }

  // Order by start date (Melissa's call: soonest first), programs without
  // a start date after that.
  results.sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return a.startDate.localeCompare(b.startDate)
  })

  return results
}

export async function getRecurringPrograms(): Promise<RecurringProgram[]> {
  const raw = await fetchAirtableRecords({
    tableId: RECURRING_TABLE_ID,
    returnFieldsByFieldId: true,
  })

  const results: RecurringProgram[] = []

  for (const record of raw) {
    const f = record.fields
    const name = optionalString(f[RECURRING_FIELD.name])
    if (!name) continue
    if (f[RECURRING_FIELD.publish] !== true || f[RECURRING_FIELD.hide] === true)
      continue

    results.push(parseBase(f, record.id, name, RECURRING_FIELD))
  }

  // Recurring programs have no dates — alphabetical keeps them scannable.
  results.sort((a, b) => a.name.localeCompare(b.name))

  return results
}
