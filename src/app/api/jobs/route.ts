import { NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblyLelYCQjP6w3nV'
const VIEW_ID = 'viwDXZcviPykFzt4g'

interface AirtableRecord {
  id: string
  fields: {
    '!Title'?: string
    '!Description'?: string
    '!Org'?: string
    "Org's logo"?: Array<{
      url: string
      thumbnails?: { large?: { url: string } }
    }>
    'Skill set text'?: string
    'Location (formatted)'?: string
    '!MinimumExperienceLevel (text)'?: string
    'Role type text'?: string
    'Work location'?: string
    "Org's vacancies page"?: string
    '!Salary (display)'?: string
    '!Date it closes'?: string
    'Date published'?: string
  }
}

export interface Job {
  id: string
  name: string
  description: string
  organization: string
  logo: string | null
  skillSet: string
  location: string
  minimumExperience: string
  roleType: string
  workLocation: string
  url: string
  lastModified: string | null
  datePublished: string | null
}

export async function GET() {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return NextResponse.json(
      { error: 'Airtable credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const allRecords: Job[] = []
    let offset: string | null = null

    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
      url.searchParams.set('view', VIEW_ID)
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
        if (!fields['!Title']) continue

        let logo: string | null = null
        const logoField = fields["Org's logo"]
        if (logoField && logoField.length > 0) {
          logo = logoField[0].url
        }

        allRecords.push({
          id: record.id,
          name: fields['!Title'],
          description: fields['!Description'] || '',
          organization: fields['!Org'] || '',
          logo,
          skillSet: fields['Skill set text'] || '',
          location: fields['Location (formatted)'] || '',
          minimumExperience: fields['!MinimumExperienceLevel (text)'] || '',
          roleType: fields['Role type text'] || '',
          workLocation: fields['Work location'] || '',
          url: fields["Org's vacancies page"] || '#',
          lastModified: fields['!Date it closes'] || null,
          datePublished: fields['Date published'] || null,
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
    console.error('Error fetching jobs data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs data' },
      { status: 500 }
    )
  }
}
