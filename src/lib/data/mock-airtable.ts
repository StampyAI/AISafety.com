export interface MockAirtableRecord {
  id: string
  fields: Record<string, unknown>
}

const MOCK_LAST_UPDATED: Record<string, string> = {
  events: '2026-10-16T00:00:00.000Z',
  map: '2026-10-12T00:00:00.000Z',
  communities: '2026-10-14T00:00:00.000Z',
  'self-study': '2026-10-10T00:00:00.000Z',
  jobs: '2026-10-18T00:00:00.000Z',
  funding: '2026-10-08T00:00:00.000Z',
  'media-channels': '2026-10-11T00:00:00.000Z',
  advisors: '2026-10-09T00:00:00.000Z',
  projects: '2026-10-07T00:00:00.000Z',
  founders: '2026-10-05T00:00:00.000Z',
}

const MOCK_TABLES: Record<string, MockAirtableRecord[]> = {
  tblx0L8qJEaLBxJFS: [
    {
      id: 'rec_mock_event_1',
      fields: {
        Name: 'Mock AI Safety Workshop',
        Description:
          'Local mock event used when Airtable credentials are not configured.',
        'Host name': 'AISafety.com contributors',
        Type: ['Workshop'],
        Location: ['Online'],
        'Start date': '2026-10-16',
        'End date': '2026-10-18',
        'Applications/registrations close': '2026-10-15',
        'Applications open or today': '2026-09-01',
        URL: 'https://example.com/mock-event',
        'Last modified': MOCK_LAST_UPDATED.events,
      },
    },
    {
      id: 'rec_mock_event_2',
      fields: {
        Name: 'Other Mock',
        Description:
          'Local mock event used when Airtable credentials are not configured.',
        'Host name': 'AISafety.com contributors',
        Type: ['Workshop'],
        Location: ['Online'],
        'Start date': '2026-10-16',
        'End date': '2026-10-18',
        'Applications/registrations close': '2026-10-15',
        'Applications open or today': '2026-09-01',
        URL: 'https://example.com/mock-event',
        'Last modified': MOCK_LAST_UPDATED.events,
      },
    },
    {
      id: 'rec_mock_event_1',
      fields: {
        Name: 'Third Mock',
        Description:
          'Local mock event used when Airtable credentials are not configured.',
        'Host name': 'AISafety.com contributors',
        Type: ['Workshop'],
        Location: ['Online'],
        'Start date': '2026-10-16',
        'End date': '2026-10-18',
        'Applications/registrations close': '2026-10-15',
        'Applications open or today': '2026-09-01',
        URL: 'https://example.com/mock-event',
        'Last modified': MOCK_LAST_UPDATED.events,
      },
    },
  ],
  tblvzbGL9q9dOO9Nc: [
    {
      id: 'rec_mock_map_1',
      fields: {
        'Long name': 'Mock AI Safety Hub',
        'Long name for cards': 'Mock AI Safety Hub',
        'Short name': 'MASH',
        Description: 'Example map entry shown locally without Airtable access.',
        'Category (text)': 'Training and education',
        Status: 'Active',
        Link: 'https://example.com/mock-map-hub',
        'Short URL': 'mockhub.org',
        x: 42,
        y: 36,
        Scale: 'Medium',
      },
    },
    {
      id: 'rec_mock_map_2',
      fields: {
        'Long name': 'Mock Governance Lab',
        'Long name for cards': 'Mock Governance Lab',
        'Short name': 'MGL',
        Description: 'Second map entry for local development.',
        'Category (text)': 'Governance',
        Status: 'Active',
        Link: 'https://example.com/mock-governance-lab',
        x: 58,
        y: 54,
        Scale: 'Small',
      },
    },
    {
      id: 'rec_mock_map_3',
      fields: {
        'Long name': 'Mock Research Collective',
        'Long name for cards': 'Mock Research Collective',
        'Short name': 'MRC',
        Description: 'Community research group for local development.',
        'Category (text)': 'Research',
        Status: 'Active',
        Link: 'https://example.com/mock-research',
        x: 24,
        y: 48,
        Scale: 'Small',
      },
    },
    {
      id: 'rec_mock_map_4',
      fields: {
        'Long name': 'Mock Policy Center',
        'Long name for cards': 'Mock Policy Center',
        'Short name': 'MPC',
        Description: 'Policy and governance lab shown in local development.',
        'Category (text)': 'Policy',
        Status: 'Active',
        Link: 'https://example.com/mock-policy-center',
        x: 70,
        y: 20,
        Scale: 'Large',
      },
    },
    {
      id: 'rec_mock_map_last_updated',
      fields: {
        'Long name': 'Last updated',
        'Long name for cards': 'Last updated',
        Description: 'October 12, 2026',
      },
    },
    {
      id: 'rec_mock_map_suggest_entry',
      fields: {
        'Long name': 'Suggest entry',
        'Long name for cards': 'Suggest entry',
        Description: 'Submit a new map entry',
        Link: '/map/suggest',
      },
    },
    {
      id: 'rec_mock_map_suggest_correction',
      fields: {
        'Long name': 'Suggest correction',
        'Long name for cards': 'Suggest correction',
        Description: 'Report a correction',
        Link: 'https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form',
      },
    },
  ],
  tbluI5Dll697WiSm8: [
    {
      id: 'rec_mock_community_1',
      fields: {
        Name: 'Mock Alignment Slack',
        Description:
          'Example online community for local development without Airtable access.',
        Platform: ['Slack'],
        'Platform wrangled': 'Slack',
        Type: ['Online'],
        'Activity level': 'High',
        Focus: 'General AI safety discussion',
        'Join link': 'https://example.com/mock-community',
        Website: 'https://example.com/mock-community',
        Size: 'Large',
        Sort: 1,
        'Last modified': MOCK_LAST_UPDATED.communities,
      },
    },
    {
      id: 'rec_mock_community_2',
      fields: {
        Name: 'Mock Alignment Forum',
        Description: 'Community forum for alignment discussions.',
        Platform: ['Forum'],
        'Platform wrangled': 'Forum',
        Type: ['Online'],
        'Activity level': 'Medium',
        Focus: 'Research and critique',
        'Join link': 'https://example.com/mock-community-forum',
        Website: 'https://example.com/mock-community-forum',
        Size: 'Medium',
        Sort: 2,
        'Last modified': MOCK_LAST_UPDATED.communities,
      },
    },
    {
      id: 'rec_mock_community_3',
      fields: {
        Name: 'Mock Local Study Group',
        Description: 'In-person study group for practitioners.',
        Platform: ['Meetup'],
        'Platform wrangled': 'Meetup',
        Type: ['Local'],
        'Activity level': 'Low',
        Focus: 'Skill-building',
        'Join link': 'https://example.com/mock-local-group',
        Website: 'https://example.com/mock-local-group',
        Size: 'Small',
        Sort: 3,
        'Last modified': MOCK_LAST_UPDATED.communities,
      },
    },
  ],
  tblRNYJ0m1cmJXKKk: [
    {
      id: 'rec_mock_course_1',
      fields: {
        Name: 'Mock AI Safety Curriculum',
        Description:
          'A sample self-study entry so the page remains populated in local development.',
        Category: ['Introductory'],
        Type: ['Course'],
        'Created by': 'AISafety.com',
        Link: 'https://example.com/mock-course',
        'Last modified': MOCK_LAST_UPDATED['self-study'],
      },
    },
    {
      id: 'rec_mock_course_2',
      fields: {
        Name: 'Mock Intro to Safety Evaluation',
        Description: 'A short self-study module for evaluating AI systems.',
        Category: ['Introductory'],
        Type: ['Course'],
        'Created by': 'AISafety.com',
        Link: 'https://example.com/mock-course-2',
        'Last modified': MOCK_LAST_UPDATED['self-study'],
      },
    },
    {
      id: 'rec_mock_course_3',
      fields: {
        Name: 'Mock Advanced Alignment Reading',
        Description: 'Curated readings for advanced alignment topics.',
        Category: ['Advanced'],
        Type: ['Reading list'],
        'Created by': 'AISafety.com',
        Link: 'https://example.com/mock-course-3',
        'Last modified': MOCK_LAST_UPDATED['self-study'],
      },
    },
  ],
  tblyLelYCQjP6w3nV: [
    {
      id: 'rec_mock_job_1',
      fields: {
        '!Title': 'Mock Research Engineer',
        '!Description':
          'Example job listing rendered locally when Airtable is unavailable.',
        '!Org': 'Mock Alignment Lab',
        'Skill set text': ['Engineering'],
        'Location (formatted)': ['Remote'],
        '!MinimumExperienceLevel (text)': ['Mid-level'],
        'Role type text': ['Full-time'],
        'Work location': ['Remote'],
        "Org's vacancies page": 'https://example.com/mock-jobs',
        'Vacancy Button': 'https://example.com/mock-job',
        'Date published': MOCK_LAST_UPDATED.jobs,
      },
    },
    {
      id: 'rec_mock_job_2',
      fields: {
        '!Title': 'Mock Policy Researcher',
        '!Description': 'Example job listing for policy-focused roles.',
        '!Org': 'Mock Policy Lab',
        'Skill set text': ['Policy'],
        'Location (formatted)': ['Hybrid'],
        '!MinimumExperienceLevel (text)': ['Senior'],
        'Role type text': ['Full-time'],
        'Work location': ['Hybrid'],
        "Org's vacancies page": 'https://example.com/mock-policy-vacancies',
        'Vacancy Button': 'https://example.com/mock-policy-job',
        'Date published': MOCK_LAST_UPDATED.jobs,
      },
    },
    {
      id: 'rec_mock_job_3',
      fields: {
        '!Title': 'Mock Research Intern',
        '!Description':
          'Temporary internship position for student researchers.',
        '!Org': 'Mock Research Collective',
        'Skill set text': ['Research'],
        'Location (formatted)': ['Remote'],
        '!MinimumExperienceLevel (text)': ['Entry-level'],
        'Role type text': ['Internship'],
        'Work location': ['Remote'],
        "Org's vacancies page": 'https://example.com/mock-internships',
        'Vacancy Button': 'https://example.com/mock-intern-job',
        'Date published': MOCK_LAST_UPDATED.jobs,
      },
    },
  ],
  tblzMTLDZWZKqTxrq: [
    {
      id: 'rec_mock_funder_1',
      fields: {
        Name: 'Mock AI Safety Grants',
        Description: 'Sample funding source for local development.',
        Type: ['Grantmaker'],
        'Recipient type': ['Individuals'],
        'Accepting applications?': ['Yes'],
        Website: 'https://example.com/mock-funding',
        'Last modified': MOCK_LAST_UPDATED.funding,
      },
    },
    {
      id: 'rec_mock_funder_2',
      fields: {
        Name: 'Mock Fellowship Fund',
        Description: 'Small fellowship program for early-career researchers.',
        Type: ['Fellowship'],
        'Recipient type': ['Individuals'],
        'Accepting applications?': ['No'],
        Website: 'https://example.com/mock-fellowship',
        'Last modified': MOCK_LAST_UPDATED.funding,
      },
    },
    {
      id: 'rec_mock_funder_3',
      fields: {
        Name: 'Mock Research Grants',
        Description: 'Funding for small research projects.',
        Type: ['Grantmaker'],
        'Recipient type': ['Teams'],
        'Accepting applications?': ['Yes'],
        Website: 'https://example.com/mock-research-grants',
        'Last modified': MOCK_LAST_UPDATED.funding,
      },
    },
  ],
  tblCTOMzyH3vILL5I: [
    {
      id: 'rec_mock_media_1',
      fields: {
        Name: 'Mock Alignment Newsletter',
        Description: 'Sample media channel for local development.',
        Type: ['Newsletter'],
        Link: 'https://example.com/mock-newsletter',
        'Last modified': MOCK_LAST_UPDATED['media-channels'],
      },
    },
    {
      id: 'rec_mock_media_2',
      fields: {
        Name: 'Mock Research Blog',
        Description: 'A blog covering experiments and findings.',
        Type: ['Blog'],
        Link: 'https://example.com/mock-research-blog',
        'Last modified': MOCK_LAST_UPDATED['media-channels'],
      },
    },
    {
      id: 'rec_mock_media_3',
      fields: {
        Name: 'Mock Podcast',
        Description: 'Interviews with AI safety practitioners.',
        Type: ['Podcast'],
        Link: 'https://example.com/mock-podcast',
        'Last modified': MOCK_LAST_UPDATED['media-channels'],
      },
    },
  ],
  tblf3KKYnmgcjVGhD: [
    {
      id: 'rec_mock_advisor_1',
      fields: {
        Name: 'Mock Career Advisor',
        Description:
          'Example advisor card used locally when Airtable credentials are missing.',
        Focus: ['Career strategy'],
        Status: ['Active'],
        Link: 'https://example.com/mock-advisor',
        'Last modified': MOCK_LAST_UPDATED.advisors,
      },
    },
    {
      id: 'rec_mock_advisor_2',
      fields: {
        Name: 'Mock Research Advisor',
        Description: 'Advisor focusing on research careers.',
        Focus: ['Research'],
        Status: ['Active'],
        Link: 'https://example.com/mock-research-advisor',
        'Last modified': MOCK_LAST_UPDATED.advisors,
      },
    },
    {
      id: 'rec_mock_advisor_3',
      fields: {
        Name: 'Mock Policy Advisor',
        Description: 'Advisor focusing on policy and governance.',
        Focus: ['Policy'],
        Status: ['Active'],
        Link: 'https://example.com/mock-policy-advisor',
        'Last modified': MOCK_LAST_UPDATED.advisors,
      },
    },
  ],
  tblHT29QNgMYKB8iW: [
    {
      id: 'rec_mock_project_1',
      fields: {
        'Project Name': 'Mock Interpretability Sprint',
        'Description (short)':
          'Sample volunteer project for local development.',
        Status: ['Active'],
        'Contact name': 'Project Lead',
        'Contact email': 'project@example.com',
        'Last modified': MOCK_LAST_UPDATED.projects,
      },
    },
    {
      id: 'rec_mock_project_2',
      fields: {
        'Project Name': 'Mock Safety Dataset',
        'Description (short)': 'Dataset curation sprint for reproducibility.',
        Status: ['Active'],
        'Contact name': 'Dataset Lead',
        'Contact email': 'dataset@example.com',
        'Last modified': MOCK_LAST_UPDATED.projects,
      },
    },
    {
      id: 'rec_mock_project_3',
      fields: {
        'Project Name': 'Mock Evaluation Benchmarks',
        'Description (short)':
          'Building evaluation benchmarks for model behavior.',
        Status: ['Active'],
        'Contact name': 'Bench Lead',
        'Contact email': 'bench@example.com',
        'Last modified': MOCK_LAST_UPDATED.projects,
      },
    },
  ],
  tbl59Ye8oxvPjoVJv: [
    {
      id: 'rec_mock_founder_1',
      fields: {
        Name: 'Mock Founder Handbook',
        Sort: 1,
        Type: ['Guide'],
        Description: 'Example founder resource for local development.',
        Website: 'https://example.com/mock-founder-resource',
        'Last modified': MOCK_LAST_UPDATED.founders,
      },
    },
    {
      id: 'rec_mock_founder_2',
      fields: {
        Name: 'Mock Founder Toolkit',
        Sort: 2,
        Type: ['Toolkit'],
        Description: 'Practical resources for starting a project.',
        Website: 'https://example.com/mock-founder-toolkit',
        'Last modified': MOCK_LAST_UPDATED.founders,
      },
    },
    {
      id: 'rec_mock_founder_3',
      fields: {
        Name: 'Mock Founder Playbook',
        Sort: 3,
        Type: ['Guide'],
        Description: 'Playbook describing common founder workflows.',
        Website: 'https://example.com/mock-founder-playbook',
        'Last modified': MOCK_LAST_UPDATED.founders,
      },
    },
  ],
}

export function getMockAirtableRecords(tableId: string): MockAirtableRecord[] {
  return MOCK_TABLES[tableId] ?? []
}

export function getMockLastUpdated(resource: string): string | null {
  return MOCK_LAST_UPDATED[resource] ?? null
}

export function isMockAirtableMode(): boolean {
  // Allow forcing mock mode in development by setting NEXT_PUBLIC_USE_MOCK_AIRTABLE
  const forced =
    process.env.NEXT_PUBLIC_USE_MOCK_AIRTABLE === '1' ||
    process.env.NEXT_PUBLIC_USE_MOCK_AIRTABLE === 'true'

  return forced || !process.env.AIRTABLE_TOKEN || !process.env.AIRTABLE_BASE_ID
}
