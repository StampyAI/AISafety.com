import {
  fetchAirtableRecords,
  fieldFeatured,
  fieldString,
  fieldText,
  publishedFormula,
} from './airtable'

const TABLE_ID = 'tblHT29QNgMYKB8iW'
const VIEW_ID = 'viwVgPN3hgpGa8dRE'

// Permanent Airtable field IDs for the Projects table. Fetching, filtering
// and sorting by ID keeps the page working when fields are renamed.
const FIELD = {
  projectName: 'fldtfqsPSKc5ubNs4', // Project Name
  descriptionShort: 'fldbeRqlUCLsgOcCT', // Description (short)
  status: 'fld57KJsNvSKFLoHT', // Status
  contactName: 'fldejiM6qWUfXAeqO', // Contact name
  contactEmail: 'fldNhMihsnXhsHMnc', // Contact email
  featured: 'fldMxxOYWQGlWTZ9D', // Featured
  featuredTagline: 'fld8LvgC3dnT40Vbl', // Featured tagline
  sort: 'fldNvTVR11SJjYu2l', // Sort
  publish: 'fldrGDtZxpFLQfjMz', // Publish?
  hide: 'fldPjPfUW5hK98ysn', // Hide?
} as const

export interface Project {
  id: string
  name: string
  description: string
  logo: string | null
  contact: string
  email: string | null
  status: string
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getProjects(): Promise<Project[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    returnFieldsByFieldId: true,
    filterByFormula: publishedFormula(FIELD.publish, FIELD.hide),
    sort: [{ field: FIELD.sort, direction: 'asc' }],
  })

  const results: Project[] = []
  for (const record of raw) {
    const f = record.fields
    const name = fieldString(f[FIELD.projectName])
    if (!name) continue

    results.push({
      id: record.id,
      name,
      description: fieldString(f[FIELD.descriptionShort]) || '',
      logo: null,
      contact: fieldString(f[FIELD.contactName]) || '',
      email: fieldString(f[FIELD.contactEmail]),
      status: fieldText(f[FIELD.status]),
      featured: fieldFeatured(f[FIELD.featured]),
      featuredTagline: fieldString(f[FIELD.featuredTagline]),
    })
  }

  return results
}
