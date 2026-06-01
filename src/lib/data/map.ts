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

// Sort order is hardcoded so the Airtable view sort can be changed freely
// without affecting how cards are displayed on /map.
const STATUS_ORDER = ['Active', 'Inactive']
const SCALE_ORDER_LARGE_FIRST = ['Large', 'Medium', 'Small']
const CATEGORY_ORDER = [
  'Advocacy',
  'Blog',
  'Capabilities research',
  'Career support',
  'Conceptual research',
  'Empirical research',
  'Forecasting',
  'Funding',
  'Governance',
  'Newsletter',
  'Podcast',
  'Research support',
  'Resource',
  'Strategy',
  'Training and education',
  'Video',
  'No longer active',
]

function rankIn(value: string | null | undefined, order: string[]): number {
  if (!value) return order.length + 1
  const idx = order.indexOf(value)
  return idx === -1 ? order.length : idx
}

// Multi-select sort: compare categories in selection order (not sorted),
// using each option's index in CATEGORY_ORDER as the rank, then compare
// lexicographically. Records with fewer categories sort first when the
// prefix is equal — matches Airtable's multi-select sort behavior.
function categoryIndices(category: string): number[] {
  if (!category) return [CATEGORY_ORDER.length + 1]
  return category
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => {
      const i = CATEGORY_ORDER.indexOf(c)
      return i === -1 ? CATEGORY_ORDER.length : i
    })
}

function compareCategoryIndices(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

export async function getMapData(): Promise<MapData> {
  const raw = await fetchAirtableRecords({
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    // Explicit publish gate so we never depend on the view's filter config to
    // keep unpublished orgs out of the data (and therefore out of the chatbot
    // catalog). The page's magic control rows (Last updated, Suggest entry,
    // etc.) are all published, so they pass this filter unaffected.
    filterByFormula: 'AND({Publish?} = TRUE(), {Hide?} = FALSE())',
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

  allRecords.sort((a, b) => {
    if (a.isMagic !== b.isMagic) return a.isMagic ? 1 : -1

    const statusDiff =
      rankIn(a.status, STATUS_ORDER) - rankIn(b.status, STATUS_ORDER)
    if (statusDiff !== 0) return statusDiff

    const scaleDiff =
      rankIn(a.scale, SCALE_ORDER_LARGE_FIRST) -
      rankIn(b.scale, SCALE_ORDER_LARGE_FIRST)
    if (scaleDiff !== 0) return scaleDiff

    const catDiff = compareCategoryIndices(
      categoryIndices(a.category),
      categoryIndices(b.category)
    )
    if (catDiff !== 0) return catDiff

    return a.title.localeCompare(b.title)
  })

  return {
    records: allRecords,
    lastUpdated,
    suggestEntryLink,
    suggestCorrectionLink,
  }
}
