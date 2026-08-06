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
  locationFormatted: 'fldmUJTIPAi5YIv7P', // Location (formatted)
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
  minimumExperience: string
  roleType: string
  workLocation: string
  url: string
  datePublished: string | null
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

    results.push({
      id: record.id,
      name,
      description: fieldString(f[FIELD.description]) || '',
      organization: fieldString(f[FIELD.org]) || '',
      logo,
      skillSet: fieldText(f[FIELD.skillSetText]),
      location: fieldText(f[FIELD.locationFormatted]),
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
