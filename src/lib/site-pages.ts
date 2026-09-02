/**
 * One entry per public page: the page title and the description that goes in
 * <meta> tags and in the link-preview card Slack, X, Discord etc. show when a
 * link is shared. Consumed by `pageMetadata()` (src/lib/page-metadata.ts).
 */
export type SitePage = {
  /** URL path, e.g. '/jobs'. */
  path: string
  /** Page name as shown on the page and in the nav, e.g. 'Field map'. */
  title: string
  /** One or two sentences, used for <meta name="description"> and the card. */
  description: string
}

export const SITE_PAGES = {
  events: {
    path: '/events',
    title: 'Events',
    description:
      'Find conferences, competitions, meetups, talks, and workshops in AI safety, both online and in person.',
  },
  training: {
    path: '/training',
    title: 'Training programs',
    description:
      'Find fellowships, bootcamps, and courses in AI safety to upskill and build career capital. Both online and in person.',
  },
  map: {
    path: '/map',
    title: 'Field map',
    description:
      'Map displaying the main organizations, programs, and other resources in the AI safety space.',
  },
  communities: {
    path: '/communities',
    title: 'Communities',
    description:
      'Groups dedicated to discussing and contributing to AI safety, both online and in-person.',
  },
  selfStudy: {
    path: '/self-study',
    title: 'Self-study',
    description:
      'Curricula and reading lists to dive deeper into AI safety through independent learning.',
  },
  jobs: {
    path: '/jobs',
    title: 'Jobs',
    description:
      "AI safety career opportunities. Many roles don't require technical skills.",
  },
  funding: {
    path: '/funding',
    title: 'Funding',
    description:
      'Organizations offering financial support to organizations and individuals working on AI safety.',
  },
  mediaChannels: {
    path: '/media-channels',
    title: 'Media channels',
    description:
      'Information sources to help you learn more about AI safety and stay up to date.',
  },
  advisors: {
    path: '/advisors',
    title: 'Advisors',
    description:
      'Advisors offering free guidance calls to help you most effectively contribute to AI safety.',
  },
  projects: {
    path: '/projects',
    title: 'Volunteer projects',
    description:
      'Initiatives seeking your volunteer help, focused on supporting and improving the AI safety field.',
  },
  founders: {
    path: '/founders',
    title: 'Founder toolkit',
    description:
      'Resources for starting and growing an AI safety organization, including incubators, fiscal sponsors, VCs, and practical tools.',
  },
  donationGuide: {
    path: '/donation-guide',
    title: 'Donation guide',
    description:
      'A short guide on how to donate most effectively to the AI safety field.',
  },
} as const satisfies Record<string, SitePage>
