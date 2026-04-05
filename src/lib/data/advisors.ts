import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblf3KKYnmgcjVGhD'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    Logo?: Array<{ url: string }>
    Focus?: string | string[]
    Status?: string | string[]
    Link?: string
  }
}

export interface Advisor {
  id: string
  name: string
  description: string
  logo: string | null
  focus: string
  status: string
  url: string
}

export async function getAdvisors(): Promise<Advisor[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Sort', direction: 'asc' }],
  })

  const results: Advisor[] = []
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
      focus: Array.isArray(fields.Focus)
        ? fields.Focus.join(', ')
        : fields.Focus || '',
      status: Array.isArray(fields.Status)
        ? fields.Status.join(', ')
        : fields.Status || '',
      url: fields.Link || '#',
    })
  }

  return results
}
