import type { Catalog, Listing, ListingType } from './types'
import { geocodeCity, haversineKm } from './geocode'

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
  'want',
  'looking',
  'find',
  'show',
  'me',
  'some',
  'any',
])

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? []).filter(
    t => !STOPWORDS.has(t) && t.length > 1
  )
}

interface ScoreInputs {
  nameTokens: Set<string>
  orgTokens: Set<string>
  metaTokens: Set<string>
  descTokens: Set<string>
}

function precompute(listing: Listing): ScoreInputs {
  return {
    nameTokens: new Set(tokenize(listing.name)),
    orgTokens: new Set(tokenize(listing.organization ?? '')),
    metaTokens: new Set(tokenize(Object.values(listing.meta).join(' '))),
    descTokens: new Set(tokenize(listing.description)),
  }
}

function score(queryTokens: string[], pre: ScoreInputs): number {
  let s = 0
  for (const t of queryTokens) {
    if (pre.nameTokens.has(t)) s += 5
    else if (pre.orgTokens.has(t)) s += 3
    else if (pre.metaTokens.has(t)) s += 2
    else if (pre.descTokens.has(t)) s += 1
  }
  return s
}

function matchesFilter(listing: Listing, key: string, want: unknown): boolean {
  const have = listing.meta[key]
  if (!have) return false
  const haveLower = have.toLowerCase()
  const candidates = Array.isArray(want) ? want : [want]
  for (const c of candidates) {
    if (typeof c !== 'string' || !c) continue
    if (haveLower.includes(c.toLowerCase())) return true
  }
  return false
}

function matchesAllFilters(
  listing: Listing,
  filters: Record<string, unknown>
): boolean {
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || (Array.isArray(v) && v.length === 0)) continue
    if (!matchesFilter(listing, k, v)) return false
  }
  return true
}

export interface NearOptions {
  /** Free-text city/region/country, geocoded to lat/lng. */
  city?: string
  /** Or pass coords directly. */
  lat?: number
  lng?: number
  /** Search radius in km. Defaults to 500km — wide net so the bot rarely
   *  comes back empty for a "near X" query. */
  radiusKm?: number
}

export interface SearchOptions {
  query?: string
  type?: ListingType
  filters?: Record<string, unknown>
  /** Geo filter — keeps only listings within radius of the city/coords. */
  near?: NearOptions
  limit?: number
}

export interface SearchHit {
  listing: Listing
  score: number
  distanceKm?: number
}

export async function searchCatalog(
  catalog: Catalog,
  options: SearchOptions
): Promise<SearchHit[]> {
  const queryTokens = options.query ? tokenize(options.query) : []
  // Default: no limit. Caller can pass one explicitly to cap.
  const limit =
    typeof options.limit === 'number' ? Math.max(1, options.limit) : Infinity
  const filters = options.filters ?? {}

  // Resolve geo center if `near` is present
  let center: { lat: number; lng: number } | null = null
  if (options.near) {
    if (
      typeof options.near.lat === 'number' &&
      typeof options.near.lng === 'number'
    ) {
      center = { lat: options.near.lat, lng: options.near.lng }
    } else if (options.near.city) {
      center = await geocodeCity(options.near.city)
    }
  }
  const radiusKm = options.near?.radiusKm ?? 500

  const catalogIndex = new Map<string, number>()
  catalog.listings.forEach((l, i) => catalogIndex.set(l.id, i))

  const candidates: Array<{ listing: Listing; distanceKm?: number }> = []
  for (const listing of catalog.listings) {
    if (options.type && listing.type !== options.type) continue
    if (!matchesAllFilters(listing, filters)) continue

    if (center) {
      if (
        typeof listing.latitude !== 'number' ||
        typeof listing.longitude !== 'number'
      ) {
        // For listings without coords, fall back to substring match on city
        // name in the meta.location field (best-effort).
        const cityHint = options.near?.city?.toLowerCase()
        const loc = (listing.meta.location ?? '').toLowerCase()
        if (cityHint && loc.includes(cityHint)) {
          candidates.push({ listing })
        }
        continue
      }
      const distanceKm = haversineKm(center, {
        lat: listing.latitude,
        lng: listing.longitude,
      })
      if (distanceKm <= radiusKm) {
        candidates.push({ listing, distanceKm })
      }
      continue
    }

    candidates.push({ listing })
  }

  if (queryTokens.length === 0 && !center) {
    // Filter-only browse — featured items first, then catalog order
    const sorted = [...candidates].sort((a, b) => {
      const aFeat = a.listing.featured ? 1 : 0
      const bFeat = b.listing.featured ? 1 : 0
      if (bFeat !== aFeat) return bFeat - aFeat
      return (
        (catalogIndex.get(a.listing.id) ?? Infinity) -
        (catalogIndex.get(b.listing.id) ?? Infinity)
      )
    })
    return sorted.slice(0, limit).map(c => ({ listing: c.listing, score: 1 }))
  }

  const hits: SearchHit[] = []
  for (const c of candidates) {
    if (queryTokens.length > 0) {
      const s = score(queryTokens, precompute(c.listing))
      if (s === 0 && !center) continue
      hits.push({ listing: c.listing, score: s, distanceKm: c.distanceKm })
    } else {
      // Geo-only search: every candidate is a hit, ranked by distance asc
      hits.push({ listing: c.listing, score: 1, distanceKm: c.distanceKm })
    }
  }

  hits.sort((a, b) => {
    // If we have distances, prefer closer first; ties broken by score then site order.
    if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm
    }
    if (b.score !== a.score) return b.score - a.score
    const aFeat = a.listing.featured ? 1 : 0
    const bFeat = b.listing.featured ? 1 : 0
    if (bFeat !== aFeat) return bFeat - aFeat
    return (
      (catalogIndex.get(a.listing.id) ?? Infinity) -
      (catalogIndex.get(b.listing.id) ?? Infinity)
    )
  })

  return hits.slice(0, limit)
}
