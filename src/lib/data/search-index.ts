import { getAdvisors } from './advisors'
import { fetchAirtableRecords } from './airtable'
import { getCommunities } from './communities'
import { getCourses } from './self-study'
import { displayCategory, displayType } from './self-study-labels'
import { getFounderResources } from './founders'
import { getFunders } from './funding'
import { getJobs } from './jobs'
import { getMapData } from './map'
import { getMediaChannels } from './media-channels'
import { getProjects } from './projects'

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
    'Events & training',
    '/events-and-training',
    '/images/calendar.svg',
    'Upcoming events, fellowships, and training programs.'
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

async function getEventEntries(): Promise<SearchEntry[]> {
  const raw = await fetchAirtableRecords({
    tableId: 'tblx0L8qJEaLBxJFS',
    viewId: 'viwHl72bJxCb2SfrL',
    fields: [
      'Name',
      'Description',
      'Host name',
      'Type',
      'Location',
      'Start date',
      'End date',
      'Applications/registrations close',
      'Applications open or today',
      'URL',
    ],
    sort: [{ field: 'Start date', direction: 'asc' }],
  })

  const today = new Date().toISOString().slice(0, 10)
  const entries: SearchEntry[] = []

  for (const record of raw) {
    const f = record.fields as {
      Name?: string
      Description?: string
      'Host name'?: string
      Type?: string[]
      Location?: string[]
      'Start date'?: string
      'End date'?: string
      'Applications/registrations close'?: string
      'Applications open or today'?: string
      URL?: string
    }
    const name = f.Name
    const startDate = f['Start date']
    if (!name || !startDate) continue
    const endDate = f['End date'] || startDate
    if (endDate < today) continue

    const closesOn = f['Applications/registrations close']
    const openOrToday = f['Applications open or today']
    const appsOpen =
      !!closesOn && !!openOrToday && openOrToday <= today && closesOn >= today

    const url = f.URL || ''
    let logo: string | null = null
    if (url) {
      try {
        const domain = new URL(url).hostname
        logo = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      } catch (err) {
        // Data-quality issue, not a code bug — warn so it's fixed at the source.
        console.warn(
          `Search index: ignoring malformed event URL "${url}" (${(err as Error).message})`
        )
      }
    }

    const dateRange =
      endDate !== startDate ? `${startDate} – ${endDate}` : startDate
    const types = f.Type || []
    const locations = f.Location || []

    entries.push({
      type: 'event',
      title: name,
      subtitle: f['Host name'] || '',
      description: f.Description || '',
      category: [
        dateRange,
        types.join(', '),
        locations.join(', '),
        appsOpen ? 'Applications open' : '',
      ]
        .filter(Boolean)
        .join(' · '),
      url: url || '/events-and-training',
      logo,
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
      category: [displayCategory(c.category), displayType(c.courseType)]
        .filter(Boolean)
        .join(' · '),
      url: c.url || '/self-study',
      logo: c.image,
    })
  }

  entries.push(...eventEntries)

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
