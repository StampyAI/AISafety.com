// Matomo event tracking helpers.
// The Matomo tracker snippet lives in src/app/layout.tsx and initializes
// window._paq. These helpers safely no-op when _paq isn't available
// (e.g. during SSR or if the tracker fails to load).

type Paq = { push: (args: unknown[]) => void }

declare global {
  interface Window {
    _paq?: Paq
  }
}

/**
 * Track a click on a listing (funder, job, event, course, etc.).
 * Category is "Listings - <page>" to match the legacy Webflow event format.
 */
export function trackListingClick(page: string, name: string, url: string) {
  if (typeof window === 'undefined') return
  const paq = window._paq
  if (!paq) return
  paq.push(['trackEvent', `Listings - ${page}`, name, url])
}
