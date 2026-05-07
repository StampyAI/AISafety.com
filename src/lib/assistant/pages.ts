export interface PageInfo {
  path: string
  title: string
  purpose: string
  audience: string
  greeting: string
  chips: string[]
}

export const PAGES: PageInfo[] = [
  {
    path: '/',
    title: 'Home',
    purpose:
      'Top-level entry point with cards linking to events, the field map, communities, courses, jobs, funders, advisors, projects, donation guide, and AISafety.info for conceptual learning.',
    audience: 'Anyone arriving for the first time.',
    greeting:
      'What are you looking for? I can point you to jobs, funders, communities, courses, and other curated listings, or answer a quick question about AI safety.',
    chips: [
      "I'm new to AI safety",
      'Communities near me',
      "Who's working on AI policy?",
    ],
  },
  {
    path: '/jobs',
    title: 'Jobs',
    purpose:
      'AI safety job listings with filters for skill set, minimum experience, role type, and work location.',
    audience:
      'Career-changers, students, and professionals exploring AI safety roles.',
    greeting:
      'Looking for a role in AI safety? Tell me what kind of work, seniority, or location you want.',
    chips: [
      'Junior policy roles I could realistically get hired for',
      'Remote technical roles',
      'Operations and ops jobs',
      'Roles for non-technical people',
    ],
  },
  {
    path: '/funding',
    title: 'Funding',
    purpose:
      'Funders and grant programs supporting AI safety projects, with filters for type and whether they are accepting applications.',
    audience: 'Researchers, organizers, and founders seeking funding.',
    greeting:
      'Looking for funding? I can match funders by what you do, your stage, and whether they are open to applications.',
    chips: [
      'Funders accepting applications now',
      'Grants for individual researchers',
      'Funding for new orgs',
    ],
  },
  {
    path: '/donation-guide',
    title: 'Donation guide',
    purpose:
      'Tabbed guide that recommends donation strategies based on amount ($1–$1k, $1k–$10k, $10k–$100k, $100k+) and time available (5min–1hr, 1–50hrs, ongoing, major focus).',
    audience: 'Donors trying to give effectively.',
    greeting:
      'Want to give to AI safety effectively? Tell me roughly how much you want to donate and how much time you have.',
    chips: [
      'I want to donate $5,000 this weekend',
      'Best fund for a small donation',
      'Where do major donors give?',
    ],
  },
  {
    path: '/advisors',
    title: 'Advisors',
    purpose:
      'Free 1-on-1 career and project advising services, with filters for focus area and accepting status.',
    audience: 'Anyone looking for human guidance on getting into AI safety.',
    greeting:
      'Want a one-on-one chat with someone in the field? Tell me your focus and I can match you to an advisor.',
    chips: [
      'Talk to a career advisor',
      'Advisors for technical research',
      'Advisors for policy careers',
    ],
  },
  {
    path: '/communities',
    title: 'Communities',
    purpose:
      'Online and in-person AI safety communities, with a world map and filters for platform, type, focus, and activity level.',
    audience: 'People wanting to connect with others in AI safety.',
    greeting:
      'Looking for a community? Tell me your platform, focus, or topic and I can find a fit.',
    chips: [
      'Communities near me',
      'Active online discussion groups',
      'Beginner-friendly communities',
    ],
  },
  {
    path: '/self-study',
    title: 'Self-study',
    purpose:
      'Courses, curricula, and structured study guides for learning AI safety on your own, filterable by category and type.',
    audience: 'People who want to learn AI safety independently.',
    greeting:
      'Want to learn AI safety on your own? I can suggest a course, curriculum, or reading guide.',
    chips: [
      'Best intro course',
      'Technical alignment curriculum',
      'AI governance reading',
    ],
  },
  {
    path: '/events-and-training',
    title: 'Events & training',
    purpose:
      'Calendar of upcoming AI safety events, conferences, and training programs.',
    audience: 'People looking for events to attend or programs to apply to.',
    greeting: 'Looking for an upcoming event or training program in AI safety?',
    chips: ['Upcoming conferences', 'Training programs accepting applications'],
  },
  {
    path: '/founders',
    title: 'Founder toolkit',
    purpose:
      'Resources for AI safety founders: incubators, fiscal sponsors, legal support, and operational tooling.',
    audience: 'Founders starting AI safety nonprofits or projects.',
    greeting:
      'Starting an AI safety project or org? I can find incubators, fiscal sponsors, and other founder resources.',
    chips: [
      'Incubators I can apply to',
      'Fiscal sponsors',
      "I'm starting an AI safety nonprofit",
    ],
  },
  {
    path: '/projects',
    title: 'Volunteer projects',
    purpose:
      'AI safety research projects looking for volunteers, with filters for status.',
    audience: 'People with time to volunteer on AI safety work.',
    greeting:
      'Want to volunteer on AI safety work? I can match you to an active project.',
    chips: ['Active projects looking for volunteers', 'Technical projects'],
  },
  {
    path: '/media-channels',
    title: 'Media channels',
    purpose:
      'Podcasts, blogs, newsletters, and other channels publishing AI safety content, filterable by type.',
    audience: 'People who want to follow the field.',
    greeting:
      'Want to follow AI safety news and ideas? I can suggest podcasts, newsletters, and blogs.',
    chips: ['Best AI safety podcasts', 'Weekly newsletters'],
  },
  {
    path: '/map',
    title: 'Field map',
    purpose:
      'A visual map of organizations across AI safety: research labs, advocacy groups, funders, training programs, and more.',
    audience: 'Anyone who wants a bird-eye view of the ecosystem.',
    greeting:
      'Looking for orgs working on a specific area of AI safety? I can find them by category or focus.',
    chips: [
      'Research labs in alignment',
      'Advocacy organizations',
      'Career-support orgs',
    ],
  },
  {
    path: '/about',
    title: 'About',
    purpose: 'About the AISafety.com team and mission.',
    audience: 'Anyone curious about who runs the site.',
    greeting:
      'What are you looking for? I can point you to jobs, funders, communities, courses, and other curated listings, or answer a quick question about AI safety.',
    chips: ['Who maintains this site?', 'How is this site funded?'],
  },
]

export const DEFAULT_GREETING =
  'What are you looking for? I can point you to jobs, funders, communities, courses, and other curated listings, or answer a quick question about AI safety.'

export const DEFAULT_CHIPS = [
  'How do I get started?',
  'I want to donate effectively',
  'I want a job in AI safety',
  "I'm starting an AI safety project",
]

export function findPage(path: string): PageInfo | undefined {
  if (!path) return undefined
  const normalized = path.split('?')[0].split('#')[0]
  const exact = PAGES.find(p => p.path === normalized)
  if (exact) return exact
  if (normalized === '/') return PAGES.find(p => p.path === '/')
  const prefixMatch = PAGES.filter(
    p => p.path !== '/' && normalized.startsWith(p.path)
  )
  if (prefixMatch.length === 0) return undefined
  return prefixMatch.sort((a, b) => b.path.length - a.path.length)[0]
}

export function chipsFor(path: string): string[] {
  const page = findPage(path)
  return page?.chips ?? DEFAULT_CHIPS
}

export function greetingFor(path: string): string {
  const page = findPage(path)
  return page?.greeting ?? DEFAULT_GREETING
}
