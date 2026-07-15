import {
  fetchAirtableRecords,
  fieldAttachmentUrl,
  fieldFeatured,
  fieldNumber,
  fieldString,
  fieldStringArray,
  publishedFormula,
} from './airtable'

const TABLE_ID = 'tbluI5Dll697WiSm8'
const VIEW_ID = 'viwFIU3lKQHZlpc0b'

// Permanent Airtable field IDs for the Communities table. Fetching,
// filtering and sorting by ID keeps the page working when fields are
// renamed.
const FIELD = {
  name: 'fld6w8ff8niuQCtF8', // Name
  description: 'fld5EkoT2YkkbYaym', // Description
  logo: 'fldAOv9unizM1MOoh', // Logo
  platform: 'fldtB4DH4pavlH2HF', // Platform
  platformWrangled: 'fld4dZD0bxWJn09Uw', // Platform wrangled
  type: 'fldxye7cJo7hUZUvQ', // Type
  activityLevel: 'fldhmpd6FsN0wAED2', // Activity level
  focus: 'fldmV7OYSEPNKlRAk', // Focus
  link: 'flddg6m5nLsQS48Kw', // Link
  locationIfInPerson: 'fldxoaSbAsaLQRKGa', // Location (if in-person)
  size: 'fldwpS0uMsn7KjLw0', // Size
  sort: 'fldKaLNPjKAt10KGo', // Sort
  latitude: 'fldfVGghvBxhEPuH1', // Latitude
  longitude: 'fldlavJcz8Zl6MqsC', // Longitude
  featured: 'fldggxJr1i9yxhFex', // Featured
  featuredTagline: 'fldDxqDvO7vgFo2m0', // Featured tagline
  publish: 'fldV8RYP1CVzOvHpf', // Publish?
  hide: 'fldQAl9W6QDPCpdew', // Hide?
} as const

export interface Community {
  id: string
  name: string
  description: string
  logo: string | null
  platform: string[]
  platformText: string
  type: string[]
  activityLevel: string
  focus: string
  joinLink: string
  location: string | null
  size: string | null
  sort: number
  latitude: number | null
  longitude: number | null
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getCommunities(): Promise<Community[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    returnFieldsByFieldId: true,
    filterByFormula: publishedFormula(FIELD.publish, FIELD.hide),
    sort: [{ field: FIELD.sort, direction: 'asc' }],
  })

  const results: Community[] = []
  for (const record of raw) {
    const f = record.fields
    const name = fieldString(f[FIELD.name])
    if (!name) continue

    results.push({
      id: record.id,
      name,
      description: fieldString(f[FIELD.description]) || '',
      logo: fieldAttachmentUrl(f[FIELD.logo]),
      platform: fieldStringArray(f[FIELD.platform]),
      platformText: fieldString(f[FIELD.platformWrangled]) || '',
      type: fieldStringArray(f[FIELD.type]),
      activityLevel: fieldString(f[FIELD.activityLevel]) || '',
      focus: fieldString(f[FIELD.focus]) || '',
      joinLink: fieldString(f[FIELD.link]) || '#',
      location: fieldString(f[FIELD.locationIfInPerson]),
      size: fieldString(f[FIELD.size]),
      sort: fieldNumber(f[FIELD.sort]) ?? 9999,
      latitude: fieldNumber(f[FIELD.latitude]),
      longitude: fieldNumber(f[FIELD.longitude]),
      featured: fieldFeatured(f[FIELD.featured]),
      featuredTagline: fieldString(f[FIELD.featuredTagline]),
    })
  }

  return results
}
