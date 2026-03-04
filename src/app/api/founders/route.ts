import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tbl59Ye8oxvPjoVJv'
const VIEW_ID = 'viwzMBhPBk1GpQXnn'

interface AirtableRecord {
  id: string
  fields: {
    Name?: string
    Sort?: number
    Type?: string
    Image?: Array<{
      url: string
      thumbnails?: { large?: { url: string } }
    }>
    Description?: string
    Website?: string
    'Hide?'?: boolean
    'Publish?'?: boolean
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
}

export async function GET() {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const allRecords: FounderResource[] = []
    let offset: string | null = null

    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
      url.searchParams.set('view', VIEW_ID)
      url.searchParams.set('filterByFormula', '{Publish?} = TRUE()')
      url.searchParams.set('sort[0][field]', 'Sort')
      url.searchParams.set('sort[0][direction]', 'asc')
      url.searchParams.set('sort[1][field]', 'Name')
      url.searchParams.set('sort[1][direction]', 'asc')
      if (offset) {
        url.searchParams.set('offset', offset)
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
        next: { revalidate: 300 },
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

      for (const record of data.records as AirtableRecord[]) {
        const fields = record.fields
        if (!fields.Name) continue

        let image: string | null = null
        if (fields.Image && fields.Image.length > 0) {
          image = fields.Image[0].url
        }

        allRecords.push({
          id: record.id,
          name: fields.Name,
          sort: fields.Sort ?? null,
          type: fields.Type || '',
          image,
          description: fields.Description || '',
          website: fields.Website || '#',
        })
      }

      offset = data.offset || null
    } while (offset)

    const res = NextResponse.json({
      records: allRecords,
      count: allRecords.length,
    })
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600'
    )
    return res
  } catch (error) {
    console.error('Error fetching founders data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch founders data' },
      { status: 500 }
    )
  }
}
