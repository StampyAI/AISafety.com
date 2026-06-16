/** "Suggest a listing" Airtable forms, keyed by the listing TYPE the bot is
 *  inviting the visitor to submit — i.e. the type it just searched and found
 *  nothing for, NOT the page the visitor happens to be on. So a bot suggesting
 *  a community opens the communities form, one suggesting a funder opens the
 *  funding form, and so on. These mirror the "Suggest listing" button on each
 *  resource page. The type strings match search_listings' `type` values.
 *  Shared by the public widget and the admin playground.
 *
 *  `org` uses the field map's "Suggest entry" form. That form's URL is managed
 *  dynamically via an Airtable control row; the value here is a snapshot — if
 *  it's ever changed in Airtable, update it here too. `job` has no public
 *  submission form (listings come from external sources), so it falls back to
 *  the general correction form below. */
const SUGGEST_FORMS: Record<string, string> = {
  community: 'https://airtable.com/appF8XfZUGXtfi40E/pagKhplUqu07DwVqC/form',
  event: 'https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form',
  funder: 'https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form',
  course: 'https://airtable.com/appF8XfZUGXtfi40E/pag6L4BzdkxocBzqr/form',
  'media-channel':
    'https://airtable.com/appF8XfZUGXtfi40E/pagSZ7vJj9MHyYmtS/form',
  'founder-resource':
    'https://airtable.com/appF8XfZUGXtfi40E/pag1OO5TrQkO96W7R/form',
  advisor: 'https://airtable.com/appF8XfZUGXtfi40E/pagTw6PRaIHUHh8ty/form',
  project: 'https://airtable.com/appF8XfZUGXtfi40E/pagudvyKXZISztcOI/form',
  org: 'https://airtable.com/appF8XfZUGXtfi40E/pag2YaqdXhhR9Ey82/form',
}

/** Every listing type the bot may name in a [[suggest:TYPE:query]] token — the
 *  search_listings `type` values. `job` has no form of its own and resolves to
 *  the fallback below; it's still listed so the parser recognises it. */
export const SUGGEST_TYPES = [
  'community',
  'event',
  'funder',
  'course',
  'media-channel',
  'founder-resource',
  'advisor',
  'project',
  'org',
  'job',
] as const

/** Fallback when the bot named no type, an unrecognised one, or one without
 *  its own listing form (`job`). The general "Suggest a correction" form is a
 *  safe catch-all — the same one linked site-wide in the footer. */
const DEFAULT_SUGGEST_FORM =
  'https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form'

/** The "Suggest a listing" Airtable form for the listing type the bot is
 *  inviting the visitor to submit. */
export function suggestFormUrl(type: string | null | undefined): string {
  if (!type) return DEFAULT_SUGGEST_FORM
  return SUGGEST_FORMS[type.trim().toLowerCase()] ?? DEFAULT_SUGGEST_FORM
}
