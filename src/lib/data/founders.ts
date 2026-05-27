import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tbl59Ye8oxvPjoVJv'
const VIEW_ID = 'viwzMBhPBk1GpQXnn'

interface AirtableRecord {
  fields: {
    Name?: string
    Sort?: number
    Type?: string | string[]
    Image?: Array<{ url: string }>
    Description?: string
    Website?: string
    Featured?: string
    'Featured tagline'?: string
  }
}

export interface FounderResource {
  id: string
  name: string
  sort: number | null
  type: string
  image: string | null
  description: string
  website: string
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getFounderResources(): Promise<FounderResource[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [
      { field: 'Sort', direction: 'asc' },
      { field: 'Name', direction: 'asc' },
    ],
  })

  const results: FounderResource[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    let image: string | null = null
    if (fields.Image && fields.Image.length > 0) {
      image = fields.Image[0].url
    }

    results.push({
      id: record.id,
      name: fields.Name,
      sort: fields.Sort ?? null,
      type: Array.isArray(fields.Type)
        ? fields.Type.join(', ')
        : fields.Type || '',
      image,
      description: fields.Description || '',
      website: fields.Website || '#',
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  return results
}
