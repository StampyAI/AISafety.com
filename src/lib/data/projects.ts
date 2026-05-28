import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblHT29QNgMYKB8iW'
const VIEW_ID = 'viwVgPN3hgpGa8dRE'

interface AirtableRecord {
  fields: {
    'Project Name'?: string
    'Description (short)'?: string
    Status?: string | string[]
    'Contact name'?: string
    'Contact email'?: string
    Featured?: string
    'Featured tagline'?: string
  }
}

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
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Sort', direction: 'asc' }],
  })

  const results: Project[] = []
  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']
    if (!fields['Project Name']) continue

    results.push({
      id: record.id,
      name: fields['Project Name'],
      description: fields['Description (short)'] || '',
      logo: null,
      contact: fields['Contact name'] || '',
      email: fields['Contact email'] || null,
      status: Array.isArray(fields.Status)
        ? fields.Status.join(', ')
        : fields.Status || '',
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  return results
}
