import MapClient from './MapClient'

export const metadata = {
  title: 'Field Map – AISafety.com',
  description:
    'An overview of the key organizations, programs, and projects operating in the AI safety space.',
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblvzbGL9q9dOO9Nc'
const VIEW_ID = 'viwJgtDFDmaP8PyoI'

const MAGIC_ROW_NAMES = [
  'Merch',
  'Last updated',
  'Suggest correction',
  'Suggest entry',
]

interface AirtableRecord {
  id: string
  fields: {
    'Long name'?: string
    'Long name for cards'?: string
    'Short name'?: string
    Description?: string
    Category?: string[]
    'Category (text)'?: string
    Status?: string
    'Logo (for cards)'?: Array<{ url: string }>
    'Logo (for map)'?: Array<{ url: string }>
    Link?: string
    'Short URL'?: string
    'Date added'?: string
    x?: number
    y?: number
    Scale?: string
  }
}

interface MapOrg {
  id: string
  title: string
  shortName: string | null
  description: string
  category: string
  status: string
  logo: string | null
  mapLogo: string | null
  link: string
  x: number | null
  y: number | null
  scale: string | null
  isMagic: boolean
}

async function getMapData(): Promise<{
  records: MapOrg[]
  lastUpdated: string | null
  suggestEntryLink: string
  suggestCorrectionLink: string
}> {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    console.error('Airtable credentials not configured')
    return {
      records: [],
      lastUpdated: null,
      suggestEntryLink: '/map/suggest',
      suggestCorrectionLink: '#',
    }
  }

  try {
    const allRecords: MapOrg[] = []
    let offset: string | null = null
    let lastUpdated: string | null = null
    let suggestEntryLink = '/map/suggest'
    let suggestCorrectionLink = '#'

    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
      url.searchParams.set('view', VIEW_ID)
      const fields = [
        'Long name',
        'Long name for cards',
        'Short name',
        'Description',
        'Category (text)',
        'Category',
        'Status',
        'Logo (for cards)',
        'Logo (for map)',
        'Link',
        'Short URL',
        'Date added',
        'x',
        'y',
        'Scale',
      ]
      fields.forEach(f => url.searchParams.append('fields[]', f))
      if (offset) {
        url.searchParams.set('offset', offset)
      }

      let response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
        next: { revalidate: 300 },
      })

      if (!response.ok) {
        await new Promise(r => setTimeout(r, 1000))
        response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
          next: { revalidate: 300 },
        })
      }

      if (!response.ok) {
        console.warn('Airtable API error:', response.status)
        return {
          records: [],
          lastUpdated: null,
          suggestEntryLink: '/map/suggest',
          suggestCorrectionLink: '#',
        }
      }

      const data = await response.json()

      for (const record of data.records as AirtableRecord[]) {
        const fields = record.fields

        const title = fields['Long name for cards'] || fields['Long name']
        if (!title || !fields.Description) continue

        const isMagic = MAGIC_ROW_NAMES.includes(title)

        if (title === 'Last updated' && fields.Description) {
          lastUpdated = fields.Description
        }

        if (title === 'Suggest entry' && fields.Link) {
          suggestEntryLink = fields.Link
        } else if (title === 'Suggest correction' && fields.Link) {
          suggestCorrectionLink = fields.Link
        }

        let category = ''
        if (fields['Category (text)']) {
          category = fields['Category (text)']
        } else if (Array.isArray(fields.Category)) {
          category = fields.Category.join(', ')
        }

        let logo: string | null = null
        if (
          fields['Logo (for cards)'] &&
          fields['Logo (for cards)'].length > 0
        ) {
          logo = fields['Logo (for cards)'][0].url
        }

        let mapLogo: string | null = null
        if (fields['Logo (for map)'] && fields['Logo (for map)'].length > 0) {
          mapLogo = fields['Logo (for map)'][0].url
        }

        allRecords.push({
          id: record.id,
          title,
          shortName: fields['Short name'] || null,
          description: fields.Description,
          category,
          status: fields.Status || 'Active',
          logo,
          mapLogo,
          link: fields.Link || '#',
          x: fields.x ?? null,
          y: fields.y ?? null,
          scale: fields.Scale || null,
          isMagic,
        })
      }

      offset = data.offset || null
    } while (offset)

    return {
      records: allRecords,
      lastUpdated,
      suggestEntryLink,
      suggestCorrectionLink,
    }
  } catch (error) {
    console.error('Error fetching map data:', error)
    return {
      records: [],
      lastUpdated: null,
      suggestEntryLink: '/map/suggest',
      suggestCorrectionLink: '#',
    }
  }
}

export default async function MapPage() {
  const { records, lastUpdated, suggestEntryLink, suggestCorrectionLink } =
    await getMapData()

  return (
    <MapClient
      orgs={records}
      lastUpdated={lastUpdated}
      suggestEntryLink={suggestEntryLink}
      suggestCorrectionLink={suggestCorrectionLink}
    />
  )
}
