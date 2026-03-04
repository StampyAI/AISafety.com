import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblRNYJ0m1cmJXKKk'
const VIEW_ID = 'viwblgaia3x1gsqBo'

interface AirtableRecord {
  id: string
  fields: {
    Name?: string
    Description?: string
    Category?: string | string[]
    Type?: string | string[]
    'Created by'?: string
    Link?: string
    Logo?: Array<{
      url: string
      thumbnails?: { large?: { url: string } }
    }>
    'Publish?'?: boolean
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
  lastModified: string | null
}

export async function GET() {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const allRecords: Course[] = []
    let offset: string | null = null

    // Fetch all records (Airtable paginates at 100 records)
    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
      url.searchParams.set('view', VIEW_ID)
      url.searchParams.set('filterByFormula', '{Publish?} = TRUE()')
      url.searchParams.set('sort[0][field]', 'Sort')
      url.searchParams.set('sort[0][direction]', 'asc')
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

      for (const record of data.records as AirtableRecord[]) {
        const fields = record.fields
        const name = fields.Name
        if (!name) continue

        let image: string | null = null
        if (fields.Logo && fields.Logo.length > 0) {
          image = fields.Logo[0].url
        }

        allRecords.push({
          id: record.id,
          name,
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
          lastModified: null,
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
    console.error('Error fetching self-study data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch self-study data' },
      { status: 500 }
    )
  }
}
