import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblyLelYCQjP6w3nV'
const VIEW_ID = 'viwBfn9CIUVqQHUy6'

interface AirtableRecord {
  fields: {
    '!Title'?: string
    '!Description'?: string
    '!Org'?: string
    "Org's logo"?: string | Array<{ url: string }>
    'Skill set text'?: string | string[]
    'Location (formatted)'?: string | string[]
    '!MinimumExperienceLevel (text)'?: string | string[]
    'Role type text'?: string | string[]
    'Work location'?: string | string[]
    "Org's vacancies page"?: string
    'Vacancy Button'?: string
    'Date published'?: string
  }
}

const FIELDS = [
  '!Title',
  '!Description',
  '!Org',
  "Org's logo",
  'Skill set text',
  'Location (formatted)',
  '!MinimumExperienceLevel (text)',
  'Role type text',
  'Work location',
  "Org's vacancies page",
  'Vacancy Button',
  'Date published',
]

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
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    fields: FIELDS,
  })

  const results: Job[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields['!Title']) continue

    let logo: string | null = null
    const logoField = fields["Org's logo"]
    if (logoField) {
      if (typeof logoField === 'string') {
        logo = logoField
      } else if (Array.isArray(logoField) && logoField.length > 0) {
        logo = logoField[0].url
      }
    }

    results.push({
      id: record.id,
      name: fields['!Title'],
      description: fields['!Description'] || '',
      organization: fields['!Org'] || '',
      logo,
      skillSet: Array.isArray(fields['Skill set text'])
        ? fields['Skill set text'].join(', ')
        : fields['Skill set text'] || '',
      location: Array.isArray(fields['Location (formatted)'])
        ? fields['Location (formatted)'].join(', ')
        : fields['Location (formatted)'] || '',
      minimumExperience: Array.isArray(fields['!MinimumExperienceLevel (text)'])
        ? fields['!MinimumExperienceLevel (text)'].join(', ')
        : fields['!MinimumExperienceLevel (text)'] || '',
      roleType: Array.isArray(fields['Role type text'])
        ? fields['Role type text'].join(', ')
        : fields['Role type text'] || '',
      workLocation: Array.isArray(fields['Work location'])
        ? fields['Work location'].join(', ')
        : fields['Work location'] || '',
      url: fields['Vacancy Button'] || fields["Org's vacancies page"] || '#',
      datePublished: fields['Date published'] || null,
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
