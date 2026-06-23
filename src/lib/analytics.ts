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
  /** Slot the listing sat in when clicked ('F1'/'F2' or a number) — lets the
   *  dashboard tie clicks to the rank that produced them. */
  position?: string
  /** 'map' when the click came from a page's map (Map, Communities); left unset
   *  for card clicks, which the dashboard treats as the default. */
  source?: string
}

const VID_KEY = 'aisafety_vid'
const OPTOUT_KEY = 'aisafety_no_track'

/** Raw opt-out marker for this browser: the ISO timestamp it was excluded from
 *  the stats, or '' when it isn't excluded (a legacy '1' may exist from before
 *  the date was stored). The flag lives in localStorage rather than being
 *  matched on IP, because the owner is a nomad whose IP changes monthly; a
 *  per-browser flag sticks regardless of location. The dashboard control reads
 *  this directly as its reactive snapshot. */
export function getTrackingOptOut(): string {
  try {
    if (typeof localStorage === 'undefined') return ''
    return localStorage.getItem(OPTOUT_KEY) ?? ''
  } catch {
    return ''
  }
}

/** True when this browser has opted out of first-party analytics — used to keep
 *  the site owner's own clicks out of the dashboard. */
export function isTrackingOptedOut(): boolean {
  return getTrackingOptOut() !== ''
}

/** Turn first-party tracking off (true) or back on (false) for this browser.
 *  When turning off we record the moment, so the dashboard can show that the
 *  exclusion only applies from then on — earlier visits stay counted. */
export function setTrackingOptOut(optOut: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (optOut) localStorage.setItem(OPTOUT_KEY, new Date().toISOString())
    else localStorage.removeItem(OPTOUT_KEY)
  } catch {
    // Storage unavailable (private mode); nothing to persist.
  }
}

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
  // The owner can exclude their own browser from the stats.
  if (isTrackingOptedOut()) return
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
  listingId?: string,
  position?: string,
  source?: string
): void {
  if (typeof window === 'undefined') return
  // Opted-out browsers skip Matomo too, so the owner's clicks stay out of both.
  if (isTrackingOptedOut()) return
  window._paq?.push(['trackEvent', `Listings - ${page}`, name, url])
  sendTrackEvent({
    type: 'listing_click',
    page,
    label: name,
    url,
    listingId,
    position,
    source,
  })
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
