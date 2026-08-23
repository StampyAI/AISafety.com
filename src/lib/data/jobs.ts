import {
  fetchAirtableRecords,
  fieldAttachmentUrl,
  fieldString,
  fieldText,
} from './airtable'
import { fetchPublicData, hasAirtableCredentials } from './public-api'

const TABLE_ID = 'tblyLelYCQjP6w3nV'
const VIEW_ID = 'viwBfn9CIUVqQHUy6'

// Permanent Airtable field IDs for the Jobs table. Fetching and selecting
// by ID keeps the page working when fields are renamed.
const FIELD = {
  title: 'fldDVJcmd66eF3E7c', // !Title
  description: 'fldZY5rS7RSw3G6vw', // !Description
  org: 'fldG5yHF2GRnwXLcZ', // !Org
  orgLogo: 'fld0HYRj3o8ZPzIpB', // Org's logo
  skillSetText: 'fld7B5GTUR1kEj2wH', // Skill set text
  location: 'fldlVhQnyT9FuwXA2', // !Location (raw 80k format)
  minimumExperienceText: 'fldAskPW25nc6R4GZ', // !MinimumExperienceLevel (text)
  roleTypeText: 'fldCXYRLhvZbwf0Pp', // Role type text
  workLocation: 'fldffza4UJBfsjL3v', // Work location
  orgVacanciesPage: 'fldw33cUFdvqcOz64', // Org's vacancies page
  vacancyButton: 'fldihcmZcHWNWPsxe', // Vacancy Button
  datePublished: 'fldo9SdkQLyzUI9yp', // Date published
} as const

const FIELDS = Object.values(FIELD)

export interface Job {
  id: string
  name: string
  description: string
  organization: string
  logo: string | null
  skillSet: string
  location: string
  locations: string[]
  minimumExperience: string
  roleType: string
  workLocation: string
  url: string
  datePublished: string | null
}

// The 80k !Location field packs every location into one string: locations
// are comma-separated, a period separates place from country, and places
// that themselves contain a comma are wrapped in double quotes, e.g.
//   San Francisco Bay Area.USA, "New York, NY.USA", Remote.Global
export function parseJobLocations(raw: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of raw) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      tokens.push(current)
      current = ''
    } else {
      current += char
    }
  }
  tokens.push(current)

  const locations: string[] = []
  for (const token of tokens) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const dot = trimmed.lastIndexOf('.')
    if (dot === -1) {
      locations.push(trimmed)
      continue
    }
    // A leading period is 80k's legacy remote marker; drop it.
    const place = trimmed.slice(0, dot).trim().replace(/^\.+/, '')
    const country = trimmed.slice(dot + 1).trim()
    if (!place) {
      locations.push(country)
    } else if (place === 'Remote') {
      locations.push(`Remote (${country})`)
    } else {
      locations.push(`${place}, ${country}`)
    }
  }
  return locations
}

export async function getJobs(): Promise<Job[]> {
  if (!hasAirtableCredentials()) return fetchPublicData<Job>('jobs')
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    returnFieldsByFieldId: true,
    fields: FIELDS,
  })

  const results: Job[] = []
  for (const record of raw) {
    const f = record.fields
    const name = fieldString(f[FIELD.title])
    if (!name) continue

    // Org's logo is usually a URL string, but has also held attachments.
    const logoRaw = f[FIELD.orgLogo]
    const logo = fieldString(logoRaw) ?? fieldAttachmentUrl(logoRaw)

    const locations = parseJobLocations(fieldText(f[FIELD.location]))

    results.push({
      id: record.id,
      name,
      description: fieldString(f[FIELD.description]) || '',
      organization: fieldString(f[FIELD.org]) || '',
      logo,
      skillSet: fieldText(f[FIELD.skillSetText]),
      location: locations.join('; '),
      locations,
      minimumExperience: fieldText(f[FIELD.minimumExperienceText]),
      roleType: fieldText(f[FIELD.roleTypeText]),
      workLocation: fieldText(f[FIELD.workLocation]),
      url:
        fieldString(f[FIELD.vacancyButton]) ||
        fieldString(f[FIELD.orgVacanciesPage]) ||
        '#',
      datePublished: fieldString(f[FIELD.datePublished]),
    })
  }

  results.sort((a, b) => {
    if (!a.datePublished && !b.datePublished) return 0
    if (!a.datePublished) return 1
    if (!b.datePublished) return -1
    return b.datePublished.localeCompare(a.datePublished)
  })

  return results
}
