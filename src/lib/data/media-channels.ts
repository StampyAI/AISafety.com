import {
  fetchAirtableRecords,
  fieldAttachmentUrl,
  fieldFeatured,
  fieldString,
  fieldText,
  publishedFormula,
} from './airtable'

const TABLE_ID = 'tblCTOMzyH3vILL5I'
const VIEW_ID = 'viwT8KTwupcVyGKLZ'

// Permanent Airtable field IDs for the Media channels table. Fetching,
// filtering and sorting by ID keeps the page working when fields are
// renamed.
const FIELD = {
  name: 'fldsju0ew5KYrY3Qa', // Name
  description: 'fld4grLOZyX7Msjxg', // Description
  image: 'fldhHGt6N9SSWjUXG', // Image
  type: 'fldEnZ1ZYO1849kV1', // Type
  link: 'fldvCayjHmj5GuBoE', // Link
  featured: 'fldZlWHVADe5glk3g', // Featured
  featuredTagline: 'fldYalqFyaKuPJZDO', // Featured tagline
  sort: 'fldhkOSt89LF6aYE5', // Sort
  publish: 'fldMN0TF3kz41HTQc', // Publish?
  hide: 'fldxzKJV6SnPk7eD8', // Hide?
} as const

export interface MediaChannel {
  id: string
  name: string
  description: string
  logo: string | null
  type: string
  url: string
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getMediaChannels(): Promise<MediaChannel[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    returnFieldsByFieldId: true,
    filterByFormula: publishedFormula(FIELD.publish, FIELD.hide),
    sort: [{ field: FIELD.sort, direction: 'asc' }],
  })

  const results: MediaChannel[] = []
  for (const record of raw) {
    const f = record.fields
    const name = fieldString(f[FIELD.name])
    if (!name) continue

    results.push({
      id: record.id,
      name,
      description: fieldString(f[FIELD.description]) || '',
      logo: fieldAttachmentUrl(f[FIELD.image]),
      type: fieldText(f[FIELD.type]),
      url: fieldString(f[FIELD.link]) || '#',
      featured: fieldFeatured(f[FIELD.featured]),
      featuredTagline: fieldString(f[FIELD.featuredTagline]),
    })
  }

  return results
}
