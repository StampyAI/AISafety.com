// The attendee-details form (/hackathon/details), sent by email to accepted
// hackathon applicants. This file is the single source of truth for what the
// form asks: DetailsForm.tsx renders it and /api/hackathon-details validates
// against it, so editing a question here changes both. The Apps Script that
// stores answers maps them into Sheet columns by label, so no redeploy is
// needed when questions change (see docs/hackathon-signup.md).
//
// Labels and hints may contain markdown-style links: [text](https://…).

// `required` is enforced by the form (browser validation) and the API route;
// required and optional fields look the same. Optional, by Bryce's call
// (17 Aug 2026): travel notes, dietary, T-shirt size, anything else.
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

export type Section = {
  /** Omit for a run of fields with no heading of their own. */
  title?: string
  intro?: string
  fields: readonly Field[]
}

/** Length caps shared by the form (maxLength) and the API route. */
export const OTHER_MAX = 500
export function maxLen(f: Field): number {
  if ('max' in f && f.max) return f.max
  return f.type === 'textarea' ? 5000 : 500
}

// One untitled section at the moment (Bryce removed the headings); split into
// several with `title`/`intro` if the form grows headings again.
export const SECTIONS: readonly Section[] = [
  {
    fields: [
      { type: 'text', key: 'fullName', required: true, label: 'Name' },
      { type: 'email', key: 'email', required: true, label: 'Email' },
      {
        type: 'tel',
        key: 'phone',
        required: true,
        label: 'Phone number',
        hint: 'Including the country code',
        half: true,
      },
      {
        type: 'text',
        key: 'discord',
        required: true,
        label: 'Discord handle',
        hint: 'If you don’t have a Discord account, please create one',
        half: true,
      },
      {
        type: 'text',
        key: 'nationality',
        required: true,
        label: 'Nationality',
        half: true,
      },
      {
        type: 'text',
        key: 'genderPronouns',
        required: true,
        label: 'Gender and pronouns',
        half: true,
      },
      {
        type: 'select',
        key: 'checkIn',
        required: true,
        label: 'Check-in date',
        options: [
          'Wednesday 16 September',
          'Thursday 17 September',
          'Other (say more below)',
        ],
        half: true,
      },
      {
        type: 'select',
        key: 'checkOut',
        required: true,
        label: 'Check-out date',
        options: [
          'Sunday 20 September',
          'Monday 21 September',
          'Other (say more below)',
        ],
        half: true,
      },
      {
        type: 'textarea',
        key: 'travelNotes',
        label: 'Anything about your travel or dates we should know?',
        hint: 'e.g. roughly when you’ll arrive, or dates outside the options above',
      },
      {
        type: 'select',
        key: 'roomPreference',
        required: true,
        label: 'Do you have a preference for having your own room?',
        hint: 'It’s possible that some people may need to share a room – either all female or all male, max two people per room.',
        options: [
          'Fine with sharing',
          'Weak preference for own room',
          'Strong preference for own room',
        ],
      },
      {
        type: 'textarea',
        key: 'dietary',
        label: 'Do you have any allergies or dietary needs?',
        hint: 'If so, please list the allergen and its severity. All food will be vegan.',
      },
      {
        type: 'text',
        key: 'emergencyName',
        required: true,
        label: 'Emergency contact – name',
      },
      {
        type: 'tel',
        key: 'emergencyPhone',
        required: true,
        label: 'Emergency contact – phone number',
        half: true,
      },
      {
        type: 'text',
        key: 'emergencyRelation',
        required: true,
        label: 'Their relationship to you',
        half: true,
      },
      {
        type: 'select',
        key: 'shirtSize',
        label: 'T-shirt size',
        hint: 'We’re planning to make hackathon T-shirts',
        options: [
          'Men’s XS',
          'Men’s S',
          'Men’s M',
          'Men’s L',
          'Men’s XL',
          'Men’s 2XL',
          'Women’s XS',
          'Women’s S',
          'Women’s M',
          'Women’s L',
          'Women’s XL',
          'Women’s 2XL',
        ],
        half: true,
      },
      {
        type: 'textarea',
        key: 'anythingElse',
        label: 'Anything else you’d like us to know?',
      },
      {
        type: 'agree',
        key: 'ceealarTerms',
        required: true,
        label:
          'I agree to CEEALAR’s [terms and conditions](https://www.ceealar.org/terms-and-conditions) and [code of conduct](https://www.ceealar.org/code-of-conduct)',
      },
      {
        type: 'agree',
        key: 'over18',
        required: true,
        label: 'I will be at least 18 years old by the start of this event',
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
