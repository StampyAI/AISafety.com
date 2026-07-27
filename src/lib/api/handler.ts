import { getEndpoint } from './registry'
import { applyQuery } from './filter'
import {
  absolutizeAssets,
  buildMeta,
  getOrigin,
  jsonError,
  jsonResponse,
  preflight,
} from './response'

type Loader = () => Promise<readonly unknown[]>

// Site curation metadata (drives the featured cards); internal, so stripped
// from every endpoint's output.
const INTERNAL_KEYS = ['featured', 'featuredTagline']

function stripInternal(
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !INTERNAL_KEYS.includes(key))
  )
}

// Builds a GET route handler for a collection endpoint:
//   load → filter (whitelist + free-text q) → absolutize asset URLs → envelope.
// The loader reuses the existing src/lib/data getX() functions, so data shaping
// lives in one place and the API stays a thin, consistent skin over it.
export function createCollectionHandler(slug: string, loader: Loader) {
  const def = getEndpoint(slug)

  return async function GET(request: Request): Promise<Response> {
    try {
      const all = (await loader()) as Record<string, unknown>[]
      // Strip before filtering so the free-text `q` search can't match on
      // hidden values.
      const visible = all.map(stripInternal)
      const { searchParams } = new URL(request.url)
      const filtered = applyQuery(visible, searchParams, def.filterFields)
      const origin = getOrigin(request)
      const data = filtered.map(record => absolutizeAssets(record, origin))
      return jsonResponse(
        { data, meta: buildMeta(data.length) },
        { cacheSeconds: def.cacheSeconds }
      )
    } catch (err) {
      // Surfaced (not swallowed): log the cause, return an honest 503 rather
      // than a partial or fabricated payload.
      console.error(`[api/v1/${slug}] failed to load:`, err)
      return jsonError(
        `Failed to load '${slug}'. This is usually transient. Please retry.`,
        503
      )
    }
  }
}

// Shared CORS preflight handler for every collection route.
export function OPTIONS(): Response {
  return preflight()
}
