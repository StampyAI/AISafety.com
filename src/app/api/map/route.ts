import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblvzbGL9q9dOO9Nc'
const VIEW_ID = 'viwJgtDFDmaP8PyoI'

// Magic row names - these are special entries in Airtable
// - Merch: only shown on map, not in cards
// - Last updated: used to get the last updated date
// - Suggest correction/entry: map-only, links used in sidebar
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
    'Logo (for cards)'?: Array<{
      url: string
      thumbnails?: { large?: { url: string } }
    }>
    'Logo (for map)'?: Array<{
      url: string
      thumbnails?: { large?: { url: string } }
    }>
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
  shortUrl: string | null
  lastModified: string | null
  x: number | null
  y: number | null
  scale: string | null
  isMagic: boolean
}

export async function GET() {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const allRecords: MapOrg[] = []
    let offset: string | null = null
    let lastUpdatedFromMagicRow: string | null = null

    // Fetch all records (Airtable paginates at 100 records)
    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
      url.searchParams.set('view', VIEW_ID)
      // Only fetch fields we actually use to reduce payload size
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

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(
          `Airtable API error: ${response.status} ${response.statusText}`,
          errorText
        )
        return NextResponse.json(
          { error: `Airtable API error: ${response.status}` },
          { status: response.status }
        )
      }

      const data = await response.json()

      // Transform records
      for (const record of data.records as AirtableRecord[]) {
        const fields = record.fields

        const title = fields['Long name for cards'] || fields['Long name']

        // Skip records without title or description
        if (!title || !fields.Description) {
          continue
        }

        // Check if this is a magic row
        const isMagic = MAGIC_ROW_NAMES.includes(title)

        // Extract last updated date from the "Last updated" magic row
        if (title === 'Last updated' && fields.Description) {
          // The description contains the date string
          lastUpdatedFromMagicRow = fields.Description
        }

        // Get category - use text version or join array
        let category = ''
        if (fields['Category (text)']) {
          category = fields['Category (text)']
        } else if (Array.isArray(fields.Category)) {
          category = fields.Category.join(', ')
        }

        // Get logo URL from "Logo (for cards)" attachment - use original URL to preserve transparency
        let logo: string | null = null
        if (
          fields['Logo (for cards)'] &&
          fields['Logo (for cards)'].length > 0
        ) {
          logo = fields['Logo (for cards)'][0].url
        }

        // Get map logo URL from "Logo (for map)" attachment - use original URL for full resolution
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
          shortUrl: fields['Short URL'] || null,
          lastModified: fields['Date added'] || null,
          x: fields.x ?? null,
          y: fields.y ?? null,
          scale: fields.Scale || null,
          isMagic,
        })
      }

      offset = data.offset || null
    } while (offset)

    const response = NextResponse.json({
      records: allRecords,
      lastUpdated: lastUpdatedFromMagicRow,
      count: allRecords.length,
    })
    // Cache in browser for 5 minutes, allow stale for 1 hour while revalidating
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600'
    )
    return response
  } catch (error) {
    console.error('Error fetching map data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch map data' },
      { status: 500 }
    )
  }
}
