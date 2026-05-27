import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tbluI5Dll697WiSm8'
const VIEW_ID = 'viwFIU3lKQHZlpc0b'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    Logo?: Array<{ url: string }>
    Platform?: string[]
    'Platform wrangled'?: string
    Type?: string[]
    'Activity level'?: string
    Focus?: string
    'Join link'?: string
    Website?: string
    'Location (if in-person)'?: string
    Size?: string
    Sort?: number
    Latitude?: number
    Longitude?: number
    Featured?: string
    'Featured tagline'?: string
  }
}

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
  website: string | null
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
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Sort', direction: 'asc' }],
  })

  const results: Community[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    let logo: string | null = null
    if (fields.Logo && fields.Logo.length > 0) {
      logo = fields.Logo[0].url
    }

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      logo,
      platform: fields.Platform || [],
      platformText: fields['Platform wrangled'] || '',
      type: fields.Type || [],
      activityLevel: fields['Activity level'] || '',
      focus: fields.Focus || '',
      joinLink: fields['Join link'] || '#',
      website: fields.Website || null,
      location: fields['Location (if in-person)'] || null,
      size: fields.Size || null,
      sort: fields.Sort || 9999,
      latitude: fields.Latitude ?? null,
      longitude: fields.Longitude ?? null,
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  return results
}
