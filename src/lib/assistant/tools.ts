import type Anthropic from '@anthropic-ai/sdk'
import type { Catalog, Listing, ListingType } from './types'
import { searchCatalog } from './search'

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'search_listings',
    description: `Search the curated AISafety.com directory. Cards render automatically in the chat from your tool result; the model picks which to show by writing [[card:LISTING_ID|optional note]] tokens in its prose. Do NOT enumerate listings in plain text.

You should call this tool LIBERALLY. By default there is NO limit — the tool returns every match in the catalog. Better to scan many candidates and pick the best than to miss things by over-narrowing. Always pass a \`type\` to scope the search.

ARGUMENTS:

• \`type\` — listing type. One of: 'job', 'funder', 'advisor', 'community', 'course', 'founder-resource', 'project', 'media-channel', 'org', 'event'. Highly recommended.

• \`query\` — optional free-text terms. Tokens are matched against name (×5 weight), organization (×3), meta fields (×2), and description (×1). Use the user's words, related keywords, or leave empty to browse by filter alone.

• \`filters\` — optional object of meta-field constraints. Values can be a string OR an array of strings (array means OR semantics: matches if ANY value substring matches). Substring match is case-insensitive.

  Per type:
    job: skillSet ("Policy"|"Research"|"Software engineering"|"Operations"|"Outreach"|"Strategy"|"Legal"|"Data"|"Information security"|"Management"), minimumExperience ("Entry-level"|"Junior"|"Mid"|"Senior"), roleType ("Full-time"|"Part-time"|"Internship"|"Fellowship"|"Volunteering"|"Funding"), workLocation ("Remote"|"On-site"), location (city or country)
    funder: type ("Fund"|"Grant program"|"Prize"), recipientType ("Individuals"|"Organizations"), acceptingApplications ("Yes"|"No")
    community: platform ("Slack"|"Discord"|"In-person"), type, activityLevel ("Active"|"Quiet"), location
    course: category, courseType
    advisor: focus, status
    founder-resource: type
    media-channel: type ("Podcast"|"Newsletter"|"Blog"|"Video"|"Forum")
    org: category, status
    event: type ("Bootcamp"|"Competition"|"Conference"|"Course"|"Fellowship"|"Hackathon"|"Meetup"|"Reading Group"|"Talk"|"Unconference"|"Workshop"), location ("Online"|"USA"|"UK"|"Europe"|"Asia"|"Africa"|"Canada"|"Australia/New Zealand"|"Latin America"|"Middle East")

Event meta fields you can read off each result: startDate, endDate, applicationsClose, host, lengthDays. The catalog only contains upcoming or currently-running events (past ones are excluded), and they are sorted soonest-first. NOTE: an event's date being in the future does NOT mean you can still apply — its application window may already be closed. For every event result the server pre-computes \`applicationsStatus\` ('open' | 'closed' | 'unknown') and a plain-English \`applicationsNote\`. TRUST these — do not do your own date arithmetic. Card/recommend events with \`applicationsStatus: 'open'\`; for 'closed' don't suggest applying (only mention it if the user named that program). 'unknown' means there's no closing date on file (rolling, walk-in, not yet announced, or not yet open) — you may surface it, but never assert it's open or closed; just say the application deadline is unknown. Do NOT tell the user to check the link (if the deadline were findable there, we'd already have it on the site).

• \`near\` — optional geo filter. Object with \`{city: string, radiusKm?: number}\` or \`{lat, lng, radiusKm?}\`. Default radius is 500km, intentionally wide. Currently only \`community\` listings have coordinates; for other types \`near\` does a fallback substring match on the location meta field. Results within range are ranked by distance ascending. USE THIS for any "near X" / "in X" / "around X" / "close to X" location queries instead of putting the city in the query.

• \`limit\` — optional cap on results. Default: no limit (returns every match in the catalog). Pass a number only if you want to truncate (rarely useful).

WHEN STUCK:

If a search returns 0 results, do NOT give up. Broaden:
  1. Drop the most specific filter and search again.
  2. Try \`near\` with a wider \`radiusKm\` (e.g. 1500).
  3. Drop the type and search across all types with the same query.
  4. If the user asked about a city we have no exact match for, geocode via \`near: {city: 'X'}\` — even far-away matches give the user options.

EXAMPLES:

  // Find communities near a city anywhere in the world
  search_listings({ type: 'community', near: { city: 'Berlin', radiusKm: 200 } })

  // All currently-open funders for individuals
  search_listings({ type: 'funder', filters: { acceptingApplications: 'Yes', recipientType: 'Individuals' } })

  // Junior or mid-level remote policy + research roles
  search_listings({ type: 'job', filters: { skillSet: ['Policy', 'Research'], minimumExperience: ['Junior', 'Mid'], workLocation: 'Remote' } })

  // Browse all advisors
  search_listings({ type: 'advisor' })

  // Anything tagged "fellowship" across all listing types
  search_listings({ query: 'fellowship' })`,
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'job',
            'funder',
            'advisor',
            'community',
            'course',
            'founder-resource',
            'project',
            'media-channel',
            'org',
            'event',
          ],
        },
        query: { type: 'string' },
        filters: {
          type: 'object',
          additionalProperties: {
            anyOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
        },
        near: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            radiusKm: { type: 'number' },
          },
        },
        limit: { type: 'integer', minimum: 1 },
      },
      required: [],
    },
  },
  {
    name: 'get_listing',
    description:
      'Fetch full details on a single listing by id (e.g. "job:rec123ABC"). Use after search_listings when you need fields not in the summary, or when the user names a specific entry.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Catalog id, e.g. "job:rec123ABC".',
        },
      },
      required: ['id'],
    },
  },
]

interface SearchInput {
  query?: string
  type?: ListingType
  filters?: Record<string, unknown>
  near?: { city?: string; lat?: number; lng?: number; radiusKm?: number }
  limit?: number
}

interface GetListingInput {
  id?: string
}

/** Pre-computed application-window status for an event, derived from its single
 *  date field (Applications close) so the model never has to do date arithmetic
 *  itself (it gets this wrong — e.g. calling a program "open" then noting its
 *  deadline has passed in the same breath). ISO date strings (YYYY-MM-DD)
 *  compare correctly with </>= lexicographically, sidestepping timezone parsing.
 *  A deadline that falls today still counts as open (you can apply through the
 *  last day). An EMPTY close date is deliberately 'unknown' (rolling, walk-in,
 *  not yet announced, or not yet open) — never assume an empty deadline means
 *  "open". */
function eventApplicationStatus(
  meta: Record<string, unknown>,
  today: string
): {
  applicationsStatus: 'open' | 'closed' | 'unknown'
  applicationsNote: string
} {
  const close =
    typeof meta.applicationsClose === 'string'
      ? meta.applicationsClose.slice(0, 10)
      : null
  if (!close) {
    return {
      applicationsStatus: 'unknown',
      applicationsNote:
        'No closing date on file — tell the user the application deadline is unknown. Do NOT state it is open or closed, and do NOT tell them to check the link (if the deadline were findable there, we would already have it on the site).',
    }
  }
  if (close < today) {
    return {
      applicationsStatus: 'closed',
      applicationsNote: `Applications closed ${close} — do NOT recommend applying or card this as something to apply to.`,
    }
  }
  return {
    applicationsStatus: 'open',
    applicationsNote: `Open now, applications close ${close}.`,
  }
}

function summariseListing(
  l: Listing,
  today: string,
  distanceKm?: number
): object {
  const eventStatus =
    l.type === 'event'
      ? eventApplicationStatus(l.meta as Record<string, unknown>, today)
      : null
  return {
    id: l.id,
    type: l.type,
    name: l.name,
    organization: l.organization ?? null,
    description: l.description,
    meta: l.meta,
    ...(eventStatus ?? {}),
    url: l.url,
    pageUrl: l.pageUrl,
    ...(l.featured ? { featured: true } : {}),
    ...(typeof distanceKm === 'number'
      ? { distanceKm: Math.round(distanceKm) }
      : {}),
    ...(typeof l.latitude === 'number' && typeof l.longitude === 'number'
      ? { latitude: l.latitude, longitude: l.longitude }
      : {}),
  }
}

export interface ToolExecutionResult {
  ok: boolean
  content: string
  listings: Listing[]
}

async function executeSearch(
  input: SearchInput,
  catalog: Catalog
): Promise<ToolExecutionResult> {
  const hits = await searchCatalog(catalog, {
    query: input.query,
    type: input.type,
    filters: input.filters,
    near: input.near,
    limit: input.limit,
  })
  if (hits.length === 0) {
    return {
      ok: true,
      content: JSON.stringify({
        matches: 0,
        note: 'Nothing matched. BEFORE giving up, try broader: drop a filter, expand radiusKm, drop the type, try synonyms. Only after a couple of broader retries should you tell the user nothing matched and offer [[suggest:TYPE:USER_QUERY]], where TYPE is the listing type you searched (community, event, funder, course, media-channel, founder-resource, advisor, project, org). Do NOT offer a suggest form for jobs — the job board comes from 80,000 Hours and is not curated here; instead point the user to the 80,000 Hours job board.',
      }),
      listings: [],
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  return {
    ok: true,
    content: JSON.stringify({
      matches: hits.length,
      results: hits.map(h => summariseListing(h.listing, today, h.distanceKm)),
    }),
    listings: hits.map(h => h.listing),
  }
}

function executeGetListing(
  input: GetListingInput,
  catalog: Catalog
): ToolExecutionResult {
  if (!input.id)
    return { ok: false, content: 'Error: id is required', listings: [] }
  const listing = catalog.listings.find(l => l.id === input.id)
  if (!listing) {
    return {
      ok: false,
      content: `No listing with id ${input.id}`,
      listings: [],
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  return {
    ok: true,
    content: JSON.stringify(summariseListing(listing, today)),
    listings: [listing],
  }
}

export async function executeTool(
  name: string,
  input: unknown,
  catalog: Catalog
): Promise<ToolExecutionResult> {
  const safeInput = input && typeof input === 'object' ? input : {}
  switch (name) {
    case 'search_listings':
      return executeSearch(safeInput as SearchInput, catalog)
    case 'get_listing':
      return executeGetListing(safeInput as GetListingInput, catalog)
    default:
      return {
        ok: false,
        content: `Unknown tool: ${name}`,
        listings: [],
      }
  }
}
