import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblRNYJ0m1cmJXKKk'
const VIEW_ID = 'viwblgaia3x1gsqBo'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    Category?: string | string[]
    Type?: string | string[]
    'Created by'?: string
    Link?: string
    Logo?: Array<{ url: string }>
    Featured?: string
    'Featured tagline'?: string
  }
}

export interface Course {
  id: string
  name: string
  description: string
  category: string
  courseType: string
  organizer: string
  url: string
  image: string | null
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getCourses(): Promise<Course[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Sort', direction: 'asc' }],
  })

  const results: Course[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields.Name) continue

    let image: string | null = null
    if (fields.Logo && fields.Logo.length > 0) {
      image = fields.Logo[0].url
    }

    results.push({
      id: record.id,
      name: fields.Name,
      description: fields.Description || '',
      category: Array.isArray(fields.Category)
        ? fields.Category.join(', ')
        : fields.Category || '',
      courseType: Array.isArray(fields.Type)
        ? fields.Type.join(', ')
        : fields.Type || '',
      organizer: fields['Created by'] || '',
      url: fields.Link || '#',
      image,
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  return results
}
