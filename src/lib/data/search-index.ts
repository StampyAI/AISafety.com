import { getAdvisors } from './advisors'
import { getCommunities } from './communities'
import { getCourses } from './self-study'
import { getEvents } from './events'
import { getFounderResources } from './founders'
import { getFunders } from './funding'
import { getJobs } from './jobs'
import { getMapData } from './map'
import { getMediaChannels } from './media-channels'
import { getProjects } from './projects'
import { getTrainingPrograms, getRecurringPrograms } from './training'

export type SearchType =
  | 'advisor'
  | 'community'
  | 'course'
  | 'event'
  | 'founder'
  | 'funder'
  | 'job'
  | 'map'
  | 'media'
  | 'project'
  | 'training'
  | 'page'

export interface SearchEntry {
  type: SearchType
  title: string
  subtitle: string
  description: string
  category: string
  url: string
  logo: string | null
}

function page(
  title: string,
  url: string,
  icon: string | null,
  description = ''
): SearchEntry {
  return {
    type: 'page',
    title,
    subtitle: '',
    description,
    category: '',
    url,
    logo: icon,
  }
}

const STATIC_PAGES: SearchEntry[] = [
  page('Home', '/', null, 'AISafety.com — the hub for AI existential safety.'),
  page(
    'Training programs',
    '/training',
    '/images/grad-cap.svg',
    'Fellowships, bootcamps, and courses in AI safety.'
  ),
  page(
    'Events',
    '/events',
    '/images/calendar.svg',
    'Conferences, competitions, meetups, talks, and workshops in AI safety.'
  ),
  page(
    'Field map',
    '/map',
    '/images/map.svg',
    'A visual map of organisations in AI safety.'
  ),
  page(
    'Communities',
    '/communities',
    '/images/globe.svg',
    'Discussion groups and communities, online and in person.'
  ),
  page(
    'Self-study',
    '/self-study',
    '/images/book.svg',
    'Curated courses and study guides.'
  ),
  page(
    'Jobs',
    '/jobs',
    '/images/briefcase.svg',
    'Open roles across AI safety.'
  ),
  page(
    'Funding',
    '/funding',
    '/images/coins.svg',
    'Grants and funders supporting AI safety work.'
  ),
  page(
    'Media channels',
    '/media-channels',
    '/images/megaphone.svg',
    'Podcasts, newsletters, and feeds.'
  ),
  page('Advisors', '/advisors', '/images/person.svg', 'Talk to a 1-1 advisor.'),
  page(
    'Volunteer projects',
    '/projects',
    '/images/clipboard.svg',
    'Volunteer projects you can join.'
  ),
  page(
    'Founder toolkit',
    '/founders',
    '/images/rocket.svg',
    'Resources for founders building AI safety orgs.'
  ),
  page(
    'Donation guide',
    '/donation-guide',
    '/images/heart.svg',
    'How to donate effectively.'
  ),
  page(
    'About',
    '/about',
    '/images/people.svg',
    'Mission, team, and how to contribute.'
  ),
]

// The data layer normalizes a missing URL to '#'; treat that as no URL.
function realUrl(url: string): string {
  return url === '#' ? '' : url
}

function faviconFor(url: string): string | null {
  if (!url) return null
  return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`
}

function dateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  return end && end !== start ? `${start} – ${end}` : start
}

async function getEventEntries(): Promise<SearchEntry[]> {
  const events = await getEvents()
  return events.map(e => {
    const url = realUrl(e.url)
    const deadline =
      e.applicationStatus === 'Open' && e.deadlineType && e.applicationsClose
        ? `${e.deadlineType} by ${e.applicationsClose}`
        : ''
    return {
      type: 'event' as const,
      title: e.name,
      subtitle: e.host,
      description: e.description,
      category: [
        dateRange(e.startDate, e.endDate),
        e.type.join(', '),
        e.location || e.mode,
        deadline,
      ]
        .filter(Boolean)
        .join(' · '),
      url: url || '/events',
      logo: e.logo ?? faviconFor(url),
    }
  })
}

async function getTrainingEntries(): Promise<SearchEntry[]> {
  const [upcoming, recurring] = await Promise.all([
    getTrainingPrograms(),
    getRecurringPrograms(),
  ])
  const entries: SearchEntry[] = []

  for (const p of upcoming) {
    const url = realUrl(p.url)
    const applications = p.notYetOpen
      ? 'Applications not yet open'
      : p.applicationStatus === 'Open' && p.applicationsClose
        ? `Apply by ${p.applicationsClose}`
        : ''
    entries.push({
      type: 'training',
      title: p.name,
      subtitle: p.host,
      description: p.description,
      category: [
        p.startDateApprox || dateRange(p.startDate, p.endDate),
        p.type.join(', '),
        p.location || p.mode,
        applications,
      ]
        .filter(Boolean)
        .join(' · '),
      url: url || '/training',
      logo: p.logo ?? faviconFor(url),
    })
  }

  for (const p of recurring) {
    const url = realUrl(p.url)
    entries.push({
      type: 'training',
      title: p.name,
      subtitle: p.host,
      description: p.description,
      category: ['Recurring', p.type.join(', '), p.location || p.mode]
        .filter(Boolean)
        .join(' · '),
      url: url || '/training',
      logo: p.logo ?? faviconFor(url),
    })
  }

  return entries
}

export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const [
    advisors,
    communities,
    courses,
    eventEntries,
    trainingEntries,
    founders,
    funders,
    jobs,
    mapData,
    media,
    projects,
  ] = await Promise.all([
    getAdvisors(),
    getCommunities(),
    getCourses(),
    getEventEntries(),
    getTrainingEntries(),
    getFounderResources(),
    getFunders(),
    getJobs(),
    getMapData(),
    getMediaChannels(),
    getProjects(),
  ])

  const entries: SearchEntry[] = []

  for (const a of advisors) {
    entries.push({
      type: 'advisor',
      title: a.name,
      subtitle: '',
      description: a.description,
      category: a.focus,
      url: a.url || '/advisors',
      logo: a.logo,
    })
  }

  for (const c of communities) {
    entries.push({
      type: 'community',
      title: c.name,
      subtitle: '',
      description: c.description,
      category: [c.platformText, c.focus, c.location ?? '']
        .filter(Boolean)
        .join(' · '),
      url: c.joinLink || c.website || '/communities',
      logo: c.logo,
    })
  }

  for (const c of courses) {
    entries.push({
      type: 'course',
      title: c.name,
      subtitle: '',
      description: c.description,
      category: [c.category, c.courseType].filter(Boolean).join(' · '),
      url: c.url || '/self-study',
      logo: c.image,
    })
  }

  entries.push(...eventEntries)
  entries.push(...trainingEntries)

  for (const f of founders) {
    entries.push({
      type: 'founder',
      title: f.name,
      subtitle: '',
      description: f.description,
      category: f.type,
      url: f.website || '/founders',
      logo: f.image,
    })
  }

  for (const f of funders) {
    entries.push({
      type: 'funder',
      title: f.name,
      subtitle: '',
      description: f.description,
      category: [f.type, f.acceptingApplications].filter(Boolean).join(' · '),
      url: f.url || '/funding',
      logo: f.logo,
    })
  }

  for (const j of jobs) {
    entries.push({
      type: 'job',
      title: j.name,
      subtitle: j.organization,
      description: j.description,
      category: [j.location, j.roleType, j.skillSet]
        .filter(Boolean)
        .join(' · '),
      url: j.url || '/jobs',
      logo: j.logo,
    })
  }

  for (const o of mapData.records) {
    if (o.isMagic) continue
    // Already covered by STATIC_PAGES.
    if (/^https?:\/\/(www\.)?aisafety\.com/i.test(o.link)) continue
    entries.push({
      type: 'map',
      title: o.title,
      subtitle: '',
      description: o.description,
      category: [o.category, o.status].filter(Boolean).join(' · '),
      url: o.link || '/map',
      logo: o.logo,
    })
  }

  for (const m of media) {
    entries.push({
      type: 'media',
      title: m.name,
      subtitle: '',
      description: m.description,
      category: m.type,
      url: m.url || '/media-channels',
      logo: m.logo,
    })
  }

  for (const p of projects) {
    entries.push({
      type: 'project',
      title: p.name,
      subtitle: '',
      description: p.description,
      category: p.status,
      url: p.email ? `mailto:${p.email}` : '/projects',
      logo: p.logo,
    })
  }

  entries.push(...STATIC_PAGES)

  return entries
}
