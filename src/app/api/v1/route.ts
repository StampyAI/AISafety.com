import { ENDPOINTS } from '@/lib/api/registry'
import {
  buildMeta,
  getOrigin,
  jsonResponse,
  preflight,
} from '@/lib/api/response'
import {
  API_BASE_PATH,
  DATA_LICENSE,
  DATA_LICENSE_URL,
} from '@/lib/api/constants'

export const dynamic = 'force-dynamic'

// Index of the Data API: self-describing list of endpoints + license + docs.
export async function GET(request: Request): Promise<Response> {
  const origin = getOrigin(request)
  const base = origin + API_BASE_PATH

  const endpoints = ENDPOINTS.map(endpoint => ({
    slug: endpoint.slug,
    title: endpoint.title,
    description: endpoint.description,
    url: `${base}/${endpoint.slug}`,
    filters: endpoint.filterFields,
  }))

  return jsonResponse(
    {
      data: {
        name: 'AISafety.com Data API',
        version: 'v1',
        description:
          'Public, read-only API over the AISafety.com directories. Wrapped { data, meta } responses; filter with query params; ' +
          DATA_LICENSE +
          '.',
        license: DATA_LICENSE,
        licenseUrl: DATA_LICENSE_URL,
        documentation: `${origin}/developers`,
        openapi: `${base}/openapi.json`,
        endpoints,
      },
      meta: buildMeta(endpoints.length),
    },
    { cacheSeconds: 3600 }
  )
}

export function OPTIONS(): Response {
  return preflight()
}
