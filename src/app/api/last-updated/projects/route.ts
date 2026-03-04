import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblHT29QNgMYKB8iW'

export async function GET() {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
    url.searchParams.set('filterByFormula', '{Publish?} = TRUE()')
    url.searchParams.set('sort[0][field]', 'Last Modified')
    url.searchParams.set('sort[0][direction]', 'desc')
    url.searchParams.set('maxRecords', '1')
    url.searchParams.set('fields[]', 'Last Modified')

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Airtable API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    let lastUpdatedDate: Date | null = null
    if (data.records && data.records.length > 0) {
      const modified = data.records[0].fields['Last Modified']
      if (modified) {
        lastUpdatedDate = new Date(modified)
      }
    }

    if (!lastUpdatedDate || isNaN(lastUpdatedDate.getTime())) {
      lastUpdatedDate = new Date()
    }

    return NextResponse.json({
      lastUpdated: lastUpdatedDate.toISOString(),
      formattedDate: formatDate(lastUpdatedDate),
    })
  } catch (error) {
    console.error('Error fetching last updated date:', error)
    return NextResponse.json(
      { error: 'Failed to fetch last updated date' },
      { status: 500 }
    )
  }
}

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  return new Intl.DateTimeFormat('en-GB', options).format(date)
}
