import { fetchAirtableRecords } from './airtable'
import { isPreviewRequest } from '@/lib/preview'
import { getAdvisors } from './advisors'
import { getCommunities } from './communities'
import { getEvents } from './events'
import { getFounderResources } from './founders'
import { getFunders } from './funding'
import { getJobs } from './jobs'
import { getMapData } from './map'
import { getMediaChannels } from './media-channels'
import { getProjects } from './projects'
import { getCourses } from './self-study'
import { getTrainingPrograms, getRecurringPrograms } from './training'
import { hasAirtableCredentials } from './public-api'

// Each resource's table ID, view to count from, and a minimal field (by
// permanent field ID — rename-proof) to fetch.
// adjust: manual correction for counts that don't match the live site exactly.
//
// Note: redesigned pages derive their nav count from the page's own data
// function instead (see below), so the badge always matches the on-page total
// and needs no `adjust` hack. As more pages migrate, move them out of here.
const resources = [
  {
    path: '/map',
    tableId: 'tblvzbGL9q9dOO9Nc',
    viewId: 'viwJgtDFDmaP8PyoI',
    field: 'fldqYJa5li27kVOUW', // Long name
    adjust: -4, // Grid view includes 4 category header rows that aren't displayed on the site
  },
  {
    path: '/jobs',
    tableId: 'tblyLelYCQjP6w3nV',
    viewId: 'viwBfn9CIUVqQHUy6',
    field: 'fldDVJcmd66eF3E7c', // !Title
  },
  {
    path: '/funding',
    tableId: 'tblzMTLDZWZKqTxrq',
    viewId: 'viwxv2w8utSEhUeiJ',
    field: 'fldsFpgVduYnNuYkN', // Name
  },
  {
    path: '/media-channels',
    tableId: 'tblCTOMzyH3vILL5I',
    viewId: 'viwT8KTwupcVyGKLZ',
    field: 'fldsju0ew5KYrY3Qa', // Name
  },
  {
    path: '/advisors',
    tableId: 'tblf3KKYnmgcjVGhD',
    viewId: 'viwIdRmaCar2Y6gPi',
    field: 'fldDCHQmcF8HLOz5S', // Name
  },
  {
    path: '/projects',
    tableId: 'tblHT29QNgMYKB8iW',
    viewId: 'viwVgPN3hgpGa8dRE',
    field: 'fldtfqsPSKc5ubNs4', // Project Name
  },
  {
    path: '/founders',
    tableId: 'tbl59Ye8oxvPjoVJv',
    viewId: 'viwzMBhPBk1GpQXnn',
    field: 'fldylwo2fwYtfMqM8', // Name
  },
]

// Preview-mode requests can't be served from any Next.js data cache (Draft
// Mode disables caching for the whole request), so without this memo every
// preview page view would redo all sixteen serialized Airtable reads below —
// seconds of waiting for nav badges the admin isn't checking. Held in process
// memory (one server bundle in production, so it is shared across pages) and
// never consulted outside preview mode, where the normal caches apply.
let previewCountsMemo: {
  at: number
  counts: Partial<Record<string, number>>
} | null = null
const PREVIEW_COUNTS_TTL_MS = 10 * 60_000

// Serialized to avoid hitting Airtable's 5 req/sec rate limit.
// Called at build time (static generation) so latency doesn't matter.
export async function fetchAllCounts(): Promise<
  Partial<Record<string, number>>
> {
  // Contributor mode: derive every count from the same public data the pages
  // render, so each badge matches its page. The Airtable view counts below
  // aren't available without credentials.
  if (!hasAirtableCredentials()) {
    const mapData = await getMapData()
    return {
      '/map': mapData.records.filter(r => !r.isMagic).length,
      '/communities': (await getCommunities()).length,
      '/jobs': (await getJobs()).length,
      '/funding': (await getFunders()).length,
      '/media-channels': (await getMediaChannels()).length,
      '/advisors': (await getAdvisors()).length,
      '/projects': (await getProjects()).length,
      '/founders': (await getFounderResources()).length,
      '/self-study': (await getCourses()).length,
      '/events': (await getEvents()).length,
      '/training':
        (await getTrainingPrograms()).length +
        (await getRecurringPrograms()).length,
    }
  }

  const preview = await isPreviewRequest()
  if (
    preview &&
    previewCountsMemo &&
    Date.now() - previewCountsMemo.at < PREVIEW_COUNTS_TTL_MS
  ) {
    return previewCountsMemo.counts
  }

  const counts: Partial<Record<string, number>> = {}
  for (const r of resources) {
    const raw = await fetchAirtableRecords({
      tableId: r.tableId,
      viewId: r.viewId,
      fields: [r.field],
    })
    counts[r.path] = raw.length + (r.adjust ?? 0)
  }

  // Derive redesigned pages' counts from the same data the page renders, so the
  // nav badge always matches the on-page total exactly.
  counts['/communities'] = (await getCommunities()).length
  counts['/self-study'] = (await getCourses()).length
  counts['/events'] = (await getEvents()).length
  // Both program sets the page lists: upcoming + recurring.
  counts['/training'] =
    (await getTrainingPrograms()).length + (await getRecurringPrograms()).length

  if (preview) {
    previewCountsMemo = { at: Date.now(), counts }
  }
  return counts
}
