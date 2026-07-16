import { getJobs } from '@/lib/data/jobs'
import { getFunders } from '@/lib/data/funding'
import { getAdvisors } from '@/lib/data/advisors'
import { getCommunities } from '@/lib/data/communities'
import { getCourses } from '@/lib/data/self-study'
import { getFounderResources } from '@/lib/data/founders'
import { getProjects } from '@/lib/data/projects'
import { getMediaChannels } from '@/lib/data/media-channels'
import { getMapData } from '@/lib/data/map'
import { getEvents } from '@/lib/data/events'
import type { Catalog, Listing } from './types'

// Known job-board domains. Their favicons are the platform logo, not the
// hiring org, so don't derive a favicon from job URLs that hit them.
const JOB_BOARD_HOSTS = new Set([
  'jobs.lever.co',
  'lever.co',
  'boards.greenhouse.io',
  'greenhouse.io',
  'jobs.ashbyhq.com',
  'ashbyhq.com',
  'apply.workable.com',
  'workable.com',
  'recruitee.com',
  'myworkday.com',
  'icims.com',
  'jobvite.com',
  'smartrecruiters.com',
  'careers.anthropic.com', // these all serve the org's own brand fine
])

function deriveFaviconFromUrl(
  url: string | null | undefined
): string | undefined {
  if (!url || url === '#') return undefined
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
    return `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`
  } catch {
    return undefined
  }
}

function deriveFaviconAvoidingJobBoards(
  url: string | null | undefined
): string | undefined {
  if (!url || url === '#') return undefined
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    for (const board of JOB_BOARD_HOSTS) {
      if (host === board || host.endsWith('.' + board)) {
        // Job board — don't derive, the favicon would be the platform logo
        if (host !== 'careers.anthropic.com') return undefined
      }
    }
    return `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`
  } catch {
    return undefined
  }
}

function isFeatured(item: { featured?: string | null }): boolean {
  return item.featured === '1' || item.featured === '2'
}

function compact(
  meta: Record<string, string | null | undefined>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (v && v.trim()) out[k] = v.trim()
  }
  return out
}

function clamp(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  return t.slice(0, max - 1).trimEnd() + '…'
}

export async function buildCatalog(): Promise<Catalog> {
  const [
    jobs,
    funders,
    advisors,
    communities,
    courses,
    founders,
    projects,
    mediaChannels,
    mapData,
    events,
  ] = await Promise.all([
    getJobs(),
    getFunders(),
    getAdvisors(),
    getCommunities(),
    getCourses(),
    getFounderResources(),
    getProjects(),
    getMediaChannels(),
    getMapData(),
    getEvents(),
  ])

  const listings: Listing[] = []

  // No freshness filter: the bot's catalog mirrors the live /jobs page (every
  // published, non-hidden job), so counts and lookups match what visitors see.
  // datePublished stays in meta so the model can weigh recency itself.
  for (const j of jobs) {
    listings.push({
      id: `job:${j.id}`,
      type: 'job',
      name: j.name,
      description: clamp(j.description, 280),
      organization: j.organization || undefined,
      logo: j.logo ?? deriveFaviconAvoidingJobBoards(j.url),
      url: j.url,
      pageUrl: '/jobs',
      meta: compact({
        skillSet: j.skillSet,
        minimumExperience: j.minimumExperience,
        roleType: j.roleType,
        workLocation: j.workLocation,
        location: j.location,
        datePublished: j.datePublished,
      }),
    })
  }

  for (const f of funders) {
    listings.push({
      id: `funder:${f.id}`,
      type: 'funder',
      name: f.name,
      description: clamp(f.description, 280),
      logo: f.logo ?? deriveFaviconFromUrl(f.url),
      url: f.url,
      pageUrl: '/funding',
      meta: compact({
        type: f.type,
        recipientType: f.recipientType,
        acceptingApplications: f.acceptingApplications,
      }),
      featured: isFeatured(f),
    })
  }

  for (const a of advisors) {
    listings.push({
      id: `advisor:${a.id}`,
      type: 'advisor',
      name: a.name,
      description: clamp(a.description, 280),
      logo: a.logo ?? deriveFaviconFromUrl(a.url),
      url: a.url,
      pageUrl: '/advisors',
      meta: compact({
        focus: a.focus,
        status: a.status,
      }),
      featured: isFeatured(a),
    })
  }

  for (const c of communities) {
    listings.push({
      id: `community:${c.id}`,
      type: 'community',
      name: c.name,
      description: clamp(c.description, 280),
      logo: c.logo ?? deriveFaviconFromUrl(c.joinLink),
      url: c.joinLink || '#',
      pageUrl: '/communities',
      latitude: c.latitude ?? undefined,
      longitude: c.longitude ?? undefined,
      meta: compact({
        platform: c.platformText,
        type: c.type.join(', '),
        activityLevel: c.activityLevel,
        focus: c.focus,
        location: c.location,
        size: c.size,
      }),
      featured: isFeatured(c),
    })
  }

  for (const c of courses) {
    listings.push({
      id: `course:${c.id}`,
      type: 'course',
      name: c.name,
      description: clamp(c.description, 280),
      organization: c.organizer || undefined,
      logo: c.image ?? deriveFaviconFromUrl(c.url),
      url: c.url,
      pageUrl: '/self-study',
      meta: compact({
        category: c.category,
        courseType: c.courseType,
      }),
      featured: isFeatured(c),
    })
  }

  for (const r of founders) {
    listings.push({
      id: `founder-resource:${r.id}`,
      type: 'founder-resource',
      name: r.name,
      description: clamp(r.description, 280),
      logo: r.image ?? deriveFaviconFromUrl(r.website),
      url: r.website,
      pageUrl: '/founders',
      meta: compact({
        type: r.type,
      }),
      featured: isFeatured(r),
    })
  }

  for (const p of projects) {
    listings.push({
      id: `project:${p.id}`,
      type: 'project',
      name: p.name,
      description: clamp(p.description, 280),
      url: p.email ? `mailto:${p.email}` : '#',
      pageUrl: '/projects',
      meta: compact({
        status: p.status,
        contact: p.contact,
      }),
      featured: isFeatured(p),
    })
  }

  for (const m of mediaChannels) {
    listings.push({
      id: `media-channel:${m.id}`,
      type: 'media-channel',
      name: m.name,
      description: clamp(m.description, 280),
      logo: m.logo ?? deriveFaviconFromUrl(m.url),
      url: m.url,
      pageUrl: '/media-channels',
      meta: compact({
        type: m.type,
      }),
      featured: isFeatured(m),
    })
  }

  for (const o of mapData.records) {
    if (o.isMagic) continue
    listings.push({
      id: `org:${o.id}`,
      type: 'org',
      name: o.title,
      description: clamp(o.description, 280),
      logo: o.logo ?? deriveFaviconFromUrl(o.link),
      url: o.link,
      pageUrl: '/map',
      meta: compact({
        category: o.category,
        status: o.status,
        scale: o.scale,
        // Acronym/short name (e.g. "AED", "MIRI") so users can search the org
        // by the label shown on the field map. Searchable but not displayed.
        shortName: o.shortName,
      }),
    })
  }

  for (const e of events) {
    listings.push({
      id: `event:${e.id}`,
      type: 'event',
      name: e.name,
      description: clamp(e.description, 280),
      logo: deriveFaviconFromUrl(e.url),
      url: e.url,
      pageUrl: '/events-and-training',
      meta: compact({
        type: e.type,
        location: e.location,
        host: e.host,
        startDate: e.startDate,
        endDate: e.endDate,
        applicationsClose: e.applicationsClose,
        lengthDays: e.lengthDays != null ? String(e.lengthDays) : null,
      }),
    })
  }

  return {
    listings,
    generatedAt: new Date().toISOString(),
  }
}

let cached: { catalog: Catalog; expiresAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

export async function getCatalog(): Promise<Catalog> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.catalog
  }
  const catalog = await buildCatalog()
  cached = { catalog, expiresAt: now + CACHE_TTL_MS }
  return catalog
}
