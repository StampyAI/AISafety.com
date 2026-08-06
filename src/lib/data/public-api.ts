// Contributor mode: when Airtable credentials aren't configured, the data
// layer falls back to the site's own public Data API (docs/api.md), so anyone
// can clone the repo and run the site locally with no secrets at all.
//
// The public API serves the exact objects the src/lib/data modules produce,
// minus the internal curation fields (featured / featuredTagline) — so in
// contributor mode everything renders except the featured cards.

const PUBLIC_API_ORIGIN = 'https://aisafety.com'

export function hasAirtableCredentials(): boolean {
  return Boolean(process.env.AIRTABLE_TOKEN && process.env.AIRTABLE_BASE_ID)
}

let noticeLogged = false

export async function fetchPublicData<T>(slug: string): Promise<T[]> {
  if (!noticeLogged) {
    noticeLogged = true
    console.log(
      '[contributor mode] No Airtable credentials in .env.local — ' +
        'fetching public data from aisafety.com instead. See README.md.'
    )
  }

  const url = `${PUBLIC_API_ORIGIN}/api/v1/${slug}`
  const response = await fetch(url, { next: { revalidate: 3600 } })
  if (!response.ok) {
    throw new Error(
      `Contributor-mode fetch failed: ${response.status} for ${url}. ` +
        'The live site may be briefly unavailable — retry in a moment.'
    )
  }

  const body = (await response.json()) as { data: T[] }
  return body.data
}
