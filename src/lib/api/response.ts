import {
  ATTRIBUTION,
  DATA_LICENSE,
  DATA_LICENSE_URL,
  DATA_SOURCE_URL,
  FALLBACK_ORIGIN,
} from './constants'

// Read-only, browser-embeddable API: allow any origin, GET only.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export interface ApiMeta {
  count: number
  license: string
  licenseUrl: string
  attribution: string
  source: string
  generatedAt: string
}

export function buildMeta(count: number): ApiMeta {
  return {
    count,
    license: DATA_LICENSE,
    licenseUrl: DATA_LICENSE_URL,
    attribution: ATTRIBUTION,
    source: DATA_SOURCE_URL,
    generatedAt: new Date().toISOString(),
  }
}

export function jsonResponse(
  body: unknown,
  {
    cacheSeconds = 3600,
    status = 200,
  }: { cacheSeconds?: number; status?: number } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      // Cache the response at the CDN edge per-URL (incl. query string) so
      // bursts of identical requests don't re-invoke the function.
      'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`,
    },
  })
}

export function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: { message, status } }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders })
}

// Build the absolute origin for asset URLs from forwarded headers, falling back
// to the canonical site origin when unavailable.
export function getOrigin(request: Request): string {
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!host) return FALLBACK_ORIGIN
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const proto =
    forwardedProto ||
    (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}
