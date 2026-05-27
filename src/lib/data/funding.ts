import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblzMTLDZWZKqTxrq'
const VIEW_ID = 'viwxv2w8utSEhUeiJ'

interface AirtableRecord {
  fields: {
    Name?: string
    Description?: string
    Logo?: Array<{ url: string }>
    Type?: string | string[]
    'Recipient type'?: string | string[]
    'Accepting applications?'?: string | string[]
    Website?: string
    Featured?: string
    'Featured tagline'?: string
  }
}

export interface Funder {
  id: string
  name: string
  description: string
  logo: string | null
  type: string
  recipientType: string
  acceptingApplications: string
  url: string
  featured: '1' | '2' | null
  featuredTagline: string | null
}

export async function getFunders(): Promise<Funder[]> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
    sort: [{ field: 'Sort', direction: 'asc' }],
  })

  const results: Funder[] = []
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
      type: Array.isArray(fields.Type)
        ? fields.Type.join(', ')
        : fields.Type || '',
      recipientType: Array.isArray(fields['Recipient type'])
        ? fields['Recipient type'].join(', ')
        : fields['Recipient type'] || '',
      acceptingApplications: Array.isArray(fields['Accepting applications?'])
        ? fields['Accepting applications?'].join(', ')
        : fields['Accepting applications?'] || '',
      url: fields.Website || '#',
      featured:
        fields.Featured === '1' || fields.Featured === '2'
          ? (fields.Featured as '1' | '2')
          : null,
      featuredTagline: fields['Featured tagline'] || null,
    })
  }

  return results
}
