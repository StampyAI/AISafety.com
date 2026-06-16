/** "Suggest a listing" Airtable forms, keyed by the listing TYPE the bot is
 *  inviting the visitor to submit — i.e. the type it just searched and found
 *  nothing for, NOT the page the visitor happens to be on. So a bot suggesting
 *  a community opens the communities form, one suggesting a funder opens the
 *  funding form, and so on. These mirror the "Suggest listing" button on each
 *  resource page. The type strings match search_listings' `type` values.
 *  Shared by the public widget and the admin playground.
 *
 *  Not mapped (fall back to the default below): `org` (field map, whose form is
 *  managed dynamically in Airtable) and `job` (listings come from external
 *  sources, no public submission form). */
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
}

/** Every listing type the bot may name in a [[suggest:TYPE:query]] token — the
 *  search_listings `type` values. The two without their own form (`org`, `job`)
 *  are still listed so the parser recognises them; they resolve to the default
 *  form below. */
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
 *  its own form (`org`, `job`). Communities is the most common submission. */
const DEFAULT_SUGGEST_FORM = SUGGEST_FORMS.community

/** The "Suggest a listing" Airtable form for the listing type the bot is
 *  inviting the visitor to submit. */
export function suggestFormUrl(type: string | null | undefined): string {
  if (!type) return DEFAULT_SUGGEST_FORM
  return SUGGEST_FORMS[type.trim().toLowerCase()] ?? DEFAULT_SUGGEST_FORM
}
