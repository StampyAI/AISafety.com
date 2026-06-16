// Single source of truth for the public API's collection endpoints. Drives the
// route handlers (filter whitelists, cache TTLs), the /api/v1 index, and the
// generated OpenAPI spec, so each endpoint is described in exactly one place.

export interface EndpointDef {
  slug: string
  title: string
  description: string
  // Query params consumers may filter by (whitelist).
  filterFields: string[]
  // Output field names, for documentation / OpenAPI.
  fields: string[]
  // CDN cache TTL (seconds) for this endpoint's responses.
  cacheSeconds: number
}

export const ENDPOINTS: EndpointDef[] = [
  {
    slug: 'communities',
    title: 'Communities',
    description: 'AI safety communities, groups, and meetups.',
    filterFields: [
      'platform',
      'type',
      'activityLevel',
      'focus',
      'size',
      'location',
    ],
    fields: [
      'id',
      'name',
      'description',
      'logo',
      'platform',
      'platformText',
      'type',
      'activityLevel',
      'focus',
      'joinLink',
      'website',
      'location',
      'size',
      'sort',
      'latitude',
      'longitude',
    ],
    cacheSeconds: 3600,
  },
  {
    slug: 'organizations',
    title: 'Organizations',
    description: 'Organizations on the AI safety landscape map.',
    filterFields: ['category', 'status', 'scale'],
    fields: [
      'id',
      'title',
      'tooltipTitle',
      'shortName',
      'description',
      'category',
      'status',
      'logo',
      'mapLogo',
      'link',
      'shortUrl',
      'x',
      'y',
      'scale',
    ],
    cacheSeconds: 3600,
  },
  {
    slug: 'events',
    title: 'Events & training',
    description:
      'AI safety events and training programs, online and in-person.',
    filterFields: ['type', 'location', 'host'],
    fields: [
      'id',
      'name',
      'description',
      'type',
      'location',
      'host',
      'startDate',
      'endDate',
      'registrationCloses',
      'lengthDays',
      'url',
    ],
    cacheSeconds: 3600,
  },
  {
    slug: 'jobs',
    title: 'Jobs',
    description: 'Open roles in AI safety.',
    filterFields: [
      'organization',
      'location',
      'roleType',
      'workLocation',
      'minimumExperience',
    ],
    fields: [
      'id',
      'name',
      'description',
      'organization',
      'logo',
      'skillSet',
      'location',
      'minimumExperience',
      'roleType',
      'workLocation',
      'url',
      'datePublished',
    ],
    cacheSeconds: 3600,
  },
  {
    slug: 'funding',
    title: 'Funding',
    description: 'Funders and grant programs for AI safety work.',
    filterFields: ['type', 'recipientType', 'acceptingApplications'],
    fields: [
      'id',
      'name',
      'description',
      'logo',
      'type',
      'recipientType',
      'acceptingApplications',
      'url',
    ],
    cacheSeconds: 3600,
  },
  {
    slug: 'courses',
    title: 'Self-study courses',
    description: 'Self-study courses and learning materials.',
    filterFields: ['category', 'courseType', 'organizer'],
    fields: [
      'id',
      'name',
      'description',
      'category',
      'courseType',
      'organizer',
      'url',
      'image',
    ],
    cacheSeconds: 3600,
  },
  {
    slug: 'advisors',
    title: 'Advisors',
    description: 'People offering AI safety career and research advice.',
    filterFields: ['focus', 'status'],
    fields: ['id', 'name', 'description', 'logo', 'focus', 'status', 'url'],
    cacheSeconds: 3600,
  },
  {
    slug: 'media-channels',
    title: 'Media channels',
    description: 'Podcasts, newsletters, blogs, and video channels.',
    filterFields: ['type'],
    fields: ['id', 'name', 'description', 'logo', 'type', 'url'],
    cacheSeconds: 3600,
  },
  {
    slug: 'founder-resources',
    title: 'Founder resources',
    description: 'Resources for founders of AI safety projects.',
    filterFields: ['type'],
    fields: ['id', 'name', 'description', 'image', 'type', 'sort', 'website'],
    cacheSeconds: 3600,
  },
  {
    slug: 'projects',
    title: 'Projects',
    description: 'Volunteer and collaboration opportunities.',
    filterFields: ['status'],
    fields: ['id', 'name', 'description', 'status', 'contact', 'email'],
    cacheSeconds: 3600,
  },
]

export function getEndpoint(slug: string): EndpointDef {
  const def = ENDPOINTS.find(e => e.slug === slug)
  if (!def) throw new Error(`Unknown API endpoint slug: '${slug}'`)
  return def
}
