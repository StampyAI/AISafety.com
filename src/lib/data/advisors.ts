import {
  fetchAirtableRecords,
  fieldDateOnly,
  fieldAttachmentUrl,
  fieldFeatured,
  fieldString,
  fieldText,
  publishedFormula,
} from './airtable'

const TABLE_ID = 'tblf3KKYnmgcjVGhD'
const VIEW_ID = 'viwIdRmaCar2Y6gPi'

// Permanent Airtable field IDs for the Advisors table. Fetching, filtering
// and sorting by ID keeps the page working when fields are renamed.
const FIELD = {
  name: 'fldDCHQmcF8HLOz5S', // Name
  description: 'fldKAGrIoU5VBZJ85', // Description
  logo: 'fldlN4rEUvhZBt8Bk', // Logo
  focus: 'fldJw9XfXOInZ7mCq', // Focus
  status: 'flduXnbMW0gaLpSgE', // Status
  link: 'fldAOckkk19f4aNTm', // Link
  featured: 'fldEp3grkZngt3fmk', // Featured
  featuredTagline: 'fldqzI3RhC7hwYJN2', // Featured tagline
  sort: 'fldbIK2vKzWm61CGr', // Sort
  publish: 'fldaOmFd67ORPMfTC', // Publish?
  hide: 'fldBOSo9B5KSaTZRq', // Hide?
  lastModified: 'fld8rTAfTkJBhnO0L', // Last modified
} as const

export interface Advisor {
  id: string
  dateAdded: string | null
  lastModified: string | null
  name: string
  description: string
  logo: string | null
  focus: string
  status: string
  url: string
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getAdvisors(): Promise<Advisor[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    returnFieldsByFieldId: true,
    filterByFormula: publishedFormula(FIELD.publish, FIELD.hide),
    sort: [{ field: FIELD.sort, direction: 'asc' }],
  })

  const results: Advisor[] = []
  for (const record of raw) {
    const f = record.fields
    const name = fieldString(f[FIELD.name])
    if (!name) continue

    results.push({
      id: record.id,
      dateAdded: record.createdTime?.slice(0, 10) ?? null,
      lastModified: fieldDateOnly(f[FIELD.lastModified]),
      name,
      description: fieldString(f[FIELD.description]) || '',
      logo: fieldAttachmentUrl(f[FIELD.logo]),
      focus: fieldText(f[FIELD.focus]),
      status: fieldText(f[FIELD.status]),
      url: fieldString(f[FIELD.link]) || '#',
      featured: fieldFeatured(f[FIELD.featured]),
      featuredTagline: fieldString(f[FIELD.featuredTagline]),
    })
  }

  return results
}
