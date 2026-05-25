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
  ],
}

export function getMockAirtableRecords(tableId: string): MockAirtableRecord[] {
  return MOCK_TABLES[tableId] ?? []
}

export function getMockLastUpdated(resource: string): string | null {
  return MOCK_LAST_UPDATED[resource] ?? null
}

export function isMockAirtableMode(): boolean {
  return !process.env.AIRTABLE_TOKEN || !process.env.AIRTABLE_BASE_ID
}
