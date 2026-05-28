import { NextResponse } from 'next/server'
import { buildSearchIndex } from '@/lib/data/search-index'

// Matches the Airtable cache window.
export const revalidate = 3600

export async function GET() {
  try {
    const index = await buildSearchIndex()
    return NextResponse.json(index, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (err) {
    // Don't leak internal details (Airtable URLs, table IDs) to the client.
    console.error('Failed to build search index:', err)
    return NextResponse.json(
      { error: 'Search index unavailable' },
      { status: 500 }
    )
  }
}
