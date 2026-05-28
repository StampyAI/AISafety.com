import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblCTOMzyH3vILL5I'
const VIEW_ID = 'viwT8KTwupcVyGKLZ'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    Image?: Array<{ url: string }>
    Type?: string | string[]
    Link?: string
    Featured?: string
    'Featured tagline'?: string
  }
}

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
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Sort', direction: 'asc' }],
  })

  const results: MediaChannel[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    let logo: string | null = null
    if (fields.Image && fields.Image.length > 0) {
      logo = fields.Image[0].url
    }

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      logo,
      type: Array.isArray(fields.Type)
        ? fields.Type.join(', ')
        : fields.Type || '',
      url: fields.Link || '#',
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  return results
}
