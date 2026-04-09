'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Notifies Matomo about Next.js client-side route changes.
 *
 * The Matomo tracker snippet in layout.tsx only fires `trackPageView` once on
 * initial load. Without this component, navigations between pages via Next.js
 * Link clicks would never be recorded as page views, and listing click events
 * would be attributed to the original landing page's URL.
 */
export default function MatomoRouteTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip the very first render — the Matomo snippet already fires
    // trackPageView once on initial load, so we'd otherwise double-count.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (typeof window === 'undefined' || !window._paq) return

    window._paq.push(['setCustomUrl', window.location.href])
    window._paq.push(['setDocumentTitle', document.title])
    window._paq.push(['trackPageView'])
  }, [pathname, searchParams])

  return null
}
