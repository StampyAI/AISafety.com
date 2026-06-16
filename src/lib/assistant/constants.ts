/** Per-resource-page "Suggest a listing" Airtable forms. The assistant's
 *  suggest button (shown when a catalog search comes back empty) opens the
 *  form for the page the visitor is on, so the suggestion lands in the right
 *  table — a community goes to the communities form, an event to the events
 *  form, and so on. These mirror the "Suggest listing" button on each resource
 *  page. Shared by the public widget and the admin playground so both behave
 *  identically. */
const SUGGEST_FORMS: Record<string, string> = {
  '/communities':
    'https://airtable.com/appF8XfZUGXtfi40E/pagKhplUqu07DwVqC/form',
  '/events-and-training':
    'https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form',
  '/funding': 'https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form',
  '/self-study':
    'https://airtable.com/appF8XfZUGXtfi40E/pag6L4BzdkxocBzqr/form',
  '/media-channels':
    'https://airtable.com/appF8XfZUGXtfi40E/pagSZ7vJj9MHyYmtS/form',
  '/founders': 'https://airtable.com/appF8XfZUGXtfi40E/pag1OO5TrQkO96W7R/form',
  '/advisors': 'https://airtable.com/appF8XfZUGXtfi40E/pagTw6PRaIHUHh8ty/form',
  '/projects': 'https://airtable.com/appF8XfZUGXtfi40E/pagudvyKXZISztcOI/form',
}

/** Fallback for pages without their own listing form (homepage, /about,
 *  /jobs, /map, …). Communities is the most common community-submission
 *  target. */
const DEFAULT_SUGGEST_FORM = SUGGEST_FORMS['/communities']

/** The "Suggest a listing" Airtable form to open for the page the visitor is
 *  currently on. Strips any query/hash and trailing slash before matching. */
export function suggestFormUrl(currentPage: string | null | undefined): string {
  if (!currentPage) return DEFAULT_SUGGEST_FORM
  const path = currentPage.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  return SUGGEST_FORMS[path] ?? DEFAULT_SUGGEST_FORM
}
