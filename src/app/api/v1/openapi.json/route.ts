import { ENDPOINTS } from '@/lib/api/registry'
import { corsHeaders } from '@/lib/api/response'
import { DATA_LICENSE, DATA_LICENSE_URL } from '@/lib/api/constants'

export const dynamic = 'force-static'

// OpenAPI 3.1 spec generated from the endpoint registry, so it never drifts
// from the actual routes.
export function GET(): Response {
  const paths: Record<string, unknown> = {}

  for (const endpoint of ENDPOINTS) {
    paths[`/${endpoint.slug}`] = {
      get: {
        summary: endpoint.title,
        description: endpoint.description,
        parameters: [
          ...endpoint.filterFields.map(field => ({
            name: field,
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: `Filter by ${field} (case-insensitive substring; comma-separate for OR).`,
          })),
          {
            name: 'q',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Free-text search across all fields.',
          },
        ],
        responses: {
          '200': {
            description: 'A wrapped collection of records.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Envelope' },
              },
            },
          },
        },
      },
    }
  }

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'AISafety.com Data API',
      version: '1.0.0',
      description: `Public, read-only API over the AISafety.com directories. Data licensed ${DATA_LICENSE}.`,
      license: { name: DATA_LICENSE, url: DATA_LICENSE_URL },
    },
    servers: [{ url: 'https://aisafety.com/api/v1' }],
    paths,
    components: {
      schemas: {
        Envelope: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
            meta: { $ref: '#/components/schemas/Meta' },
          },
        },
        Meta: {
          type: 'object',
          properties: {
            count: { type: 'integer' },
            license: { type: 'string' },
            licenseUrl: { type: 'string' },
            attribution: { type: 'string' },
            source: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }

  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
