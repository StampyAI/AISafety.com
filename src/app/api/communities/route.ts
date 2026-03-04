import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tbluI5Dll697WiSm8'

interface AirtableRecord {
  id: string
  fields: {
    Name?: string
    Description?: string
    Logo?: Array<{
      url: string
      thumbnails?: { large?: { url: string } }
    }>
    Platform?: string[]
    'Platform wrangled'?: string
    Type?: string[]
    'Activity level'?: string
    Focus?: string
    'Join link'?: string
    Website?: string
    'Location (if in-person)'?: string
    Size?: string
    Sort?: number
    'Publish?'?: boolean
    Latitude?: number
    Longitude?: number
  }
}

export interface Community {
  id: string
  name: string
  description: string
  logo: string | null
  platform: string[]
  platformText: string
  type: string[]
  activityLevel: string
  focus: string
  joinLink: string
  website: string | null
  location: string | null
  size: string | null
  sort: number
  latitude: number | null
  longitude: number | null
}

export async function GET() {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const allRecords: Community[] = []
    let offset: string | null = null

    // Fetch all records (Airtable paginates at 100 records)
    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
      // Filter for published records only
      url.searchParams.set('filterByFormula', '{Publish?} = TRUE()')
      // Sort by Sort field
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

      // Transform records
      for (const record of data.records as AirtableRecord[]) {
        const fields = record.fields

        // Skip records without name
        if (!fields.Name) {
          continue
        }

        // Get logo URL from attachment
        let logo: string | null = null
        if (fields.Logo && fields.Logo.length > 0) {
          logo = fields.Logo[0].url
        }

        allRecords.push({
          id: record.id,
          name: fields.Name,
          description: fields.Description || '',
          logo,
          platform: fields.Platform || [],
          platformText: fields['Platform wrangled'] || '',
          type: fields.Type || [],
          activityLevel: fields['Activity level'] || '',
          focus: fields.Focus || '',
          joinLink: fields['Join link'] || '#',
          website: fields.Website || null,
          location: fields['Location (if in-person)'] || null,
          size: fields.Size || null,
          sort: fields.Sort || 9999,
          latitude: fields.Latitude ?? null,
          longitude: fields.Longitude ?? null,
        })
      }

      offset = data.offset || null
    } while (offset)

    const res = NextResponse.json({
      communities: allRecords,
      count: allRecords.length,
    })
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600'
    )
    return res
  } catch (error) {
    console.error('Error fetching communities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch communities' },
      { status: 500 }
    )
  }
}
