import { fetchAirtableRecords } from './airtable'

const TABLE_ID = 'tblvzbGL9q9dOO9Nc'
const VIEW_ID = 'viwJgtDFDmaP8PyoI'

const MAGIC_ROW_NAMES = [
  'Merch',
  'Last updated',
  'Suggest correction',
  'Suggest entry',
]

interface AirtableRecord {
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

export interface MapOrg {
  id: string
  title: string
  tooltipTitle: string
  shortName: string | null
  description: string
  category: string
  status: string
  logo: string | null
  mapLogo: string | null
  link: string
  shortUrl: string | null
  x: number | null
  y: number | null
  scale: string | null
  isMagic: boolean
}

export interface MapData {
  records: MapOrg[]
  lastUpdated: string | null
  suggestEntryLink: string
  suggestCorrectionLink: string
}

const FIELD_LIST = [
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

export async function getMapData(): Promise<MapData> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    fields: FIELD_LIST,
  })

  const allRecords: MapOrg[] = []
  let lastUpdated: string | null = null
  let suggestEntryLink = '/map/suggest'
  let suggestCorrectionLink = '#'

  for (const record of raw) {
    const fields = record.fields as AirtableRecord['fields']

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
    if (fields['Logo (for cards)'] && fields['Logo (for cards)'].length > 0) {
      logo = fields['Logo (for cards)'][0].url
    }

    let mapLogo: string | null = null
    if (fields['Logo (for map)'] && fields['Logo (for map)'].length > 0) {
      mapLogo = fields['Logo (for map)'][0].url
    }

    // QA: 'Long name for cards' includes acronyms in brackets (e.g. "CARMA"),
    // which is correct for card titles but not for the map tooltip. The tooltip
    // should use 'Long name' (without brackets), matching the live site's LongLabel.
    const tooltipTitle = fields['Long name'] || title

    allRecords.push({
      id: record.id,
      title,
      tooltipTitle,
      shortName: fields['Short name'] || null,
      description: fields.Description,
      category,
      status: fields.Status || 'Active',
      logo,
      mapLogo,
      link: fields.Link || '#',
      shortUrl: fields['Short URL'] || null,
      x: fields.x ?? null,
      y: fields.y ?? null,
      scale: fields.Scale || null,
      isMagic,
    })
  }

  return {
    records: allRecords,
    lastUpdated,
    suggestEntryLink,
    suggestCorrectionLink,
  }
}
