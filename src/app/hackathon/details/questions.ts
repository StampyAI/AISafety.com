// The attendee-details form (/hackathon/details), sent by email to accepted
// hackathon applicants. This file is the single source of truth for what the
// form asks: DetailsForm.tsx renders it and /api/hackathon-details validates
// against it, so editing a question here changes both. The Apps Script that
// stores answers maps them into Sheet columns by label, so no redeploy is
// needed when questions change (see docs/hackathon-signup.md).
//
// Labels and hints may contain markdown-style links: [text](https://…).

export type Field =
  | {
      type: 'text' | 'email' | 'tel' | 'textarea'
      key: string
      label: string
      required?: boolean
      hint?: string
      /** Take half the row on desktop (fields are full-width by default). */
      half?: boolean
      /** Length cap, enforced client- and server-side; see maxLen(). */
      max?: number
    }
  | {
      type: 'select'
      key: string
      label: string
      options: readonly string[]
      required?: boolean
      hint?: string
      half?: boolean
    }
  | {
      type: 'checkboxes'
      key: string
      label: string
      options: readonly string[]
      /** When set, an extra "Other" option appears with a free-text box. */
      other?: string
      required?: boolean
      hint?: string
    }
  | {
      /** A single must-tick checkbox (agreements, confirmations). */
      type: 'agree'
      key: string
      label: string
      required?: boolean
      hint?: string
    }
  | {
      /** One 1–5 excitement rating per project; a "why" textarea appears
       *  (and is required) for ratings of 4 or 5. Stored as one answer per
       *  project, labelled "<short> – <project name>". */
      type: 'projects'
      key: string
      label: string
      short: string
      hint?: string
      required?: boolean
    }

export type Section = {
  title: string
  intro?: string
  fields: readonly Field[]
}

/** Candidate hackathon projects for the excitement question. Placeholder list
 *  drawn from the Notion projects list – the core team finalises it. Names
 *  become Sheet column headers, so settle the wording before the link goes
 *  out. */
export const PROJECTS: readonly { name: string; blurb: string }[] = [
  {
    name: 'Chatbot v2',
    blurb:
      'A chatbot that works more like a coach – guiding people to the most impactful next step for them.',
  },
  {
    name: 'Map v3',
    blurb:
      'The next version of the field map, e.g. clustering empirical research into control, interpretability, and evals.',
  },
  {
    name: 'New newsletters',
    blurb:
      'Moving the funding, events, and training newsletters off Substack onto something custom that looks like the site.',
  },
  {
    name: 'Better resource pages',
    blurb:
      'More data fields and filters on the resource pages, e.g. on /funding.',
  },
  {
    name: 'Events 3.0',
    blurb:
      'Recurring events, maybe a map, separating events people fly to from local ones.',
  },
  {
    name: 'Promotion',
    blurb:
      'Spreading the word about the site and its resource pages – forums, Slacks, Discords, cold outreach, maybe SEO.',
  },
  {
    name: 'Promoting the API',
    blurb: 'Getting more sites to use the communities and events API.',
  },
  {
    name: 'User research',
    blurb:
      'Interviewing users (including people at CEEALAR) to learn what works and what doesn’t.',
  },
  {
    name: 'Small improvements',
    blurb: 'Working through the backlog of small improvements on GitHub.',
  },
]

export const RATINGS = [1, 2, 3, 4, 5] as const
/** Ratings at or above this need a "why" answer. */
export const WHY_FROM = 4
/** Length caps shared by the form (maxLength) and the API route. */
export const WHY_MAX = 2000
export const OTHER_MAX = 500
export function maxLen(f: Field): number {
  if ('max' in f && f.max) return f.max
  return f.type === 'textarea' ? 5000 : 500
}

/** Picking this for check-in or check-out means the dates must be explained
 *  in the travel-notes box; both the form and the route enforce it. */
export const OTHER_DATE = 'Other (say more below)'
export const DATE_KEYS = ['checkIn', 'checkOut'] as const
export const NOTES_KEY = 'travelNotes'
export function needsTravelNotes(values: Record<string, unknown>): boolean {
  const notes = values[NOTES_KEY]
  return (
    DATE_KEYS.some(k => {
      const v = values[k]
      return typeof v === 'string' && v.trim() === OTHER_DATE
    }) && !(typeof notes === 'string' && notes.trim())
  )
}

export const SECTIONS: readonly Section[] = [
  {
    title: 'About you',
    fields: [
      { type: 'text', key: 'fullName', label: 'Name', required: true },
      { type: 'email', key: 'email', label: 'Email', required: true },
      {
        type: 'tel',
        key: 'phone',
        label: 'Phone number',
        hint: 'Including the country code',
        required: true,
        half: true,
      },
      {
        type: 'text',
        key: 'discord',
        label: 'Discord handle',
        hint: 'We coordinate on Discord during the hackathon',
        required: true,
        half: true,
      },
      {
        type: 'text',
        key: 'nationality',
        label: 'Nationality',
        required: true,
        half: true,
      },
      {
        type: 'text',
        key: 'genderPronouns',
        label: 'Gender and pronouns',
        required: true,
        half: true,
      },
      {
        type: 'agree',
        key: 'over18',
        label: 'I will be at least 18 years old by the date of this event',
        required: true,
      },
    ],
  },
  {
    title: 'Your stay at CEEALAR',
    intro:
      'The hackathon runs all day Thursday 17 September to all day Sunday 20 September 2026. Ideally arrive on Wednesday evening and leave on Sunday evening or Monday morning.',
    fields: [
      {
        type: 'select',
        key: 'checkIn',
        label: 'Check-in date',
        options: [
          'Wednesday 16 September',
          'Thursday 17 September',
          OTHER_DATE,
        ],
        required: true,
        half: true,
      },
      {
        type: 'select',
        key: 'checkOut',
        label: 'Check-out date',
        options: ['Sunday 20 September', 'Monday 21 September', OTHER_DATE],
        required: true,
        half: true,
      },
      {
        type: 'textarea',
        key: NOTES_KEY,
        label: 'Anything about your travel or dates we should know?',
        hint: 'e.g. roughly when you’ll arrive, or dates outside the options above',
      },
      {
        type: 'select',
        key: 'roomPreference',
        label: 'Do you have a preference for having your own room?',
        hint: 'It’s possible that some people may need to share a room – either all female or all male, max two people per room.',
        options: [
          'Fine with sharing',
          'Weak preference for own room',
          'Strong preference for own room',
        ],
        required: true,
      },
      {
        type: 'textarea',
        key: 'dietary',
        label: 'Do you have any allergies or dietary needs or preferences?',
        hint: 'If so, please list the allergen and its severity. All food will be vegan.',
        required: true,
      },
      {
        type: 'textarea',
        key: 'medical',
        label:
          'Do you have any particular medical or mental health needs you would like us to know about?',
        hint: 'This stays with the organizing team.',
      },
      {
        type: 'text',
        key: 'emergencyName',
        label: 'Emergency contact – name',
        hint: 'We’d only use this in a medical or other emergency',
        required: true,
      },
      {
        type: 'tel',
        key: 'emergencyPhone',
        label: 'Emergency contact – phone number',
        required: true,
        half: true,
      },
      {
        type: 'text',
        key: 'emergencyRelation',
        label: 'Their relationship to you',
        required: true,
        half: true,
      },
      {
        type: 'select',
        key: 'shirtSize',
        label: 'T-shirt size',
        hint: 'We’re planning to make hackathon T-shirts',
        options: [
          'XS',
          'S',
          'M',
          'L',
          'XL',
          '2XL',
          '3XL',
          'No T-shirt for me, thanks',
        ],
        required: true,
        half: true,
      },
    ],
  },
  {
    title: 'The work',
    intro:
      'This helps us put teams together before you arrive. Nothing here is binding – on the first day everyone gets to choose what they work on.',
    fields: [
      {
        type: 'checkboxes',
        key: 'tracks',
        label: 'Which track(s) would you like to work in?',
        options: [
          'Product and design',
          'Development',
          'Project management',
          'Promotion',
        ],
        other: 'Another track – tell us your idea below',
        required: true,
      },
      {
        type: 'text',
        key: 'experience',
        label: 'Years of experience in your chosen track(s)',
        hint: 'Rough numbers are fine, e.g. “design 4, development 1”',
      },
      {
        type: 'textarea',
        key: 'successfulProjects',
        label:
          'What have been one or two of your most successful projects, and what were the outcomes?',
        hint: 'In AI safety or otherwise – a brief answer is fine',
      },
      {
        type: 'projects',
        key: 'projects',
        label: 'How excited are you about each of these projects?',
        short: 'Excitement',
        hint: '1 = not for me, 5 = can’t wait. For anything you rate 4 or 5, tell us why you’re excited and what you could contribute.',
        required: true,
      },
      {
        type: 'textarea',
        key: 'projectIdea',
        label: 'Is there another project you’d like to propose?',
      },
    ],
  },
  {
    title: 'Fun',
    intro:
      'We set aside time each day for a break from the screens. Check any you’d like to join.',
    fields: [
      {
        type: 'checkboxes',
        key: 'activities',
        label: 'Which activities appeal to you?',
        options: [
          'Ocean swim',
          'Beach run or walk',
          'Arcade',
          'Board games',
          'Music time',
        ],
        other: 'Something else – suggest it below',
      },
    ],
  },
  {
    title: 'Last things',
    fields: [
      {
        type: 'agree',
        key: 'preReading',
        label:
          'I’ll have a quick read of the [projects list](https://app.notion.com/p/15aaef8c3f9640018d6b256d39b4ee8a?pvs=21) and the [user archetypes](https://app.notion.com/p/User-archetypes-26405b2ef69580449232e7f3c5e8cc7c) before the hackathon, so I arrive with some context',
        required: true,
      },
      {
        type: 'agree',
        key: 'ceealarTerms',
        label:
          'I agree to CEEALAR’s [terms and conditions](https://www.ceealar.org/terms-and-conditions) and [code of conduct](https://www.ceealar.org/code-of-conduct)',
        required: true,
      },
      {
        type: 'textarea',
        key: 'anythingElse',
        label: 'Anything else you’d like us to know?',
      },
    ],
  },
]

export const FIELDS: readonly Field[] = SECTIONS.flatMap(s => s.fields)

/** Strip [text](url) markdown links to plain text – for Sheet headers and
 *  the confirmation email. */
export function plainLabel(label: string): string {
  return label.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}
