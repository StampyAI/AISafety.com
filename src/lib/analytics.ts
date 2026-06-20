// Client-side analytics helpers.
//
// Every listing click runs through trackListingClick, which does two things:
//   1. Pushes a Matomo event (window._paq), exactly as before.
//   2. Sends a first-party beacon to our own /api/track endpoint.
//
// The beacon is sent IN ADDITION to Matomo and on our own domain, so clicks are
// still captured when an ad blocker strips the Matomo request. Everything here
// no-ops safely during SSR and never throws into a click handler.

type Paq = { push: (args: unknown[]) => void }

declare global {
  interface Window {
    _paq?: Paq
  }
}

interface TrackPayload {
  type: string
  page?: string
  label?: string
  url?: string
  listingId?: string
}

const VID_KEY = 'aisafety_vid'

/** A stable, anonymous per-browser id (random UUID in localStorage) so the
 *  dashboard can count UNIQUE users — e.g. not double-counting one person who
 *  opens the chatbot ten times. No PII; first-party only. Returns undefined if
 *  storage is unavailable (private mode), in which case the event is still
 *  recorded, just not deduped. */
function getVisitorId(): string | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined
    let id = localStorage.getItem(VID_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(VID_KEY, id)
    }
    return id
  } catch {
    return undefined
  }
}

/** Fire a first-party event to /api/track. Prefers sendBeacon so it survives the
 *  navigation a click triggers; falls back to keepalive fetch. */
function sendTrackEvent(payload: TrackPayload): void {
  try {
    const body = JSON.stringify({ ...payload, vid: getVisitorId() })
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        '/api/track',
        new Blob([body], { type: 'application/json' })
      )
      // sendBeacon returns false if the user agent couldn't queue it; fall
      // through to fetch rather than silently dropping the event.
      if (queued) return
    }
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch (err) {
    // Analytics must never break a click.
    console.warn('[analytics] beacon failed', err)
  }
}

/**
 * Track a click on a listing (funder, job, event, course, etc.).
 * Matomo category is "Listings - <page>" to match the legacy Webflow format.
 * `listingId` is the Airtable record id when available, so clicks can be joined
 * back to the exact source record.
 */
export function trackListingClick(
  page: string,
  name: string,
  url: string,
  listingId?: string
): void {
  if (typeof window === 'undefined') return
  window._paq?.push(['trackEvent', `Listings - ${page}`, name, url])
  sendTrackEvent({ type: 'listing_click', page, label: name, url, listingId })
}

/**
 * Track an arbitrary first-party event (e.g. a chatbot open, newsletter signup,
 * or donate click). Send-only — does not touch Matomo. Lets us start capturing
 * new actions without a schema change on the server.
 */
export function trackEvent(
  type: string,
  props: Omit<TrackPayload, 'type'> = {}
): void {
  if (typeof window === 'undefined') return
  sendTrackEvent({ type, ...props })
}
