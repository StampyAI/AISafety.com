import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblRNYJ0m1cmJXKKk'
const VIEW_ID = 'viwblgaia3x1gsqBo'

export async function GET() {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
    url.searchParams.set('view', VIEW_ID)
    url.searchParams.set('pageSize', '1')
    url.searchParams.set('sort[0][field]', 'Last Modified')
    url.searchParams.set('sort[0][direction]', 'desc')

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

    if (data.records && data.records.length > 0) {
      const lastModified = data.records[0].fields['Last Modified']
      if (lastModified) {
        const date = new Date(lastModified)
        return NextResponse.json({
          lastUpdated: date.toISOString(),
          formattedDate: formatDate(date),
        })
      }
    }

    return NextResponse.json({
      lastUpdated: null,
      formattedDate: null,
    })
  } catch (error) {
    console.error('Error fetching self-study last updated:', error)
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
