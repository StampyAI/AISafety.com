// The areas of the admin, one flag each. This file has no imports on purpose:
// the browser-side Admin admin page, the server-side gates and the nav all
// read the same list, so a new area is added here once and everything else
// follows (a tab, a checkbox, a capability).

export interface AccessFlags {
  /** /admin/chatbot/playground — try prompts against the live catalog. */
  playground: boolean
  /** /admin/chatbot/log — read visitors' chat transcripts, rate and label them. */
  conversationLog: boolean
  /** /admin/analytics — the dashboard. */
  analytics: boolean
  /** /admin/map — drag logos on the Field map. Writes x/y to Airtable. */
  mapEditor: boolean
  /** /admin/preview — see live Airtable data on the real pages, this browser only. */
  preview: boolean
  /** /admin/newsletter — approve issues. Every approval is a real send. */
  newsletter: boolean
  /** /admin/newsletter, read-only — see the drafted issues and their previews
   *  (a design reviewer, a second pair of eyes) with no way to send. Same tab;
   *  the Approve button and the send API stay behind `newsletter`. */
  newsletterPreview: boolean
  /** /admin/users — add, change or remove other people's access. */
  manageUsers: boolean
}

export type AccessArea = keyof AccessFlags

export interface AreaInfo {
  key: AccessArea
  /** Tab label, also the checkbox label on the Admin admin page. */
  label: string
  href: string
}

/** In tab order. adminHomeHref() sends a session to the first one it has. */
export const ACCESS_AREAS: AreaInfo[] = [
  { key: 'playground', label: 'Playground', href: '/admin/chatbot/playground' },
  {
    key: 'conversationLog',
    label: 'Conversation Log',
    href: '/admin/chatbot/log',
  },
  { key: 'analytics', label: 'Analytics', href: '/admin/analytics' },
  { key: 'mapEditor', label: 'Map editor', href: '/admin/map' },
  { key: 'preview', label: 'Site preview', href: '/admin/preview' },
  { key: 'newsletter', label: 'Newsletters', href: '/admin/newsletter' },
  {
    key: 'newsletterPreview',
    label: 'Newsletters (preview only)',
    href: '/admin/newsletter',
  },
  { key: 'manageUsers', label: 'Admin admin', href: '/admin/users' },
]

export const ACCESS_KEYS: AccessArea[] = ACCESS_AREAS.map(a => a.key)

/** Flags with exactly the given areas on. */
export function accessFrom(keys: readonly AccessArea[]): AccessFlags {
  const out = {} as AccessFlags
  for (const k of ACCESS_KEYS) out[k] = keys.includes(k)
  return out
}

export const ALL_ACCESS: AccessFlags = accessFrom(ACCESS_KEYS)
export const NO_ACCESS: AccessFlags = accessFrom([])

/** What a newly added person gets before the owner adjusts it: the everyday
 *  areas, none of the ones that write, send or grant. */
export const DEFAULT_NEW_ACCESS: AccessFlags = accessFrom([
  'playground',
  'conversationLog',
  'analytics',
  'preview',
])

export function hasAnyAccess(a: AccessFlags): boolean {
  return ACCESS_KEYS.some(k => a[k])
}

/** Read flags out of untrusted input: every known key becomes a boolean,
 *  unknown keys are dropped. Null when the input isn't an object at all. */
export function parseAccess(input: unknown): AccessFlags | null {
  if (!input || typeof input !== 'object') return null
  const body = input as Record<string, unknown>
  const out = {} as AccessFlags
  for (const k of ACCESS_KEYS) out[k] = body[k] === true
  return out
}
