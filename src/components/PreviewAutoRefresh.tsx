'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const POLL_MS = 5_000

/** While preview mode is on, keeps the page current without manual reloads:
 *  asks /api/admin/preview/changed a few times a minute whether this page's
 *  Airtable records moved, and re-renders when they did; also re-renders on
 *  window focus, catching anything the poll can't see (e.g. deleted
 *  records). router.refresh() re-runs the server render in place, so scroll
 *  position and client state (filters, search) survive. Renders nothing. */
export default function PreviewAutoRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  // Server time of the last poll; null = baseline not yet established.
  const sinceRef = useRef<string | null>(null)

  useEffect(() => {
    // Admin screens aren't part of the site being previewed (and are always
    // rendered fresh) — nothing to poll or refresh there.
    if (pathname.startsWith('/admin')) return

    sinceRef.current = null
    let stopped = false

    const tick = async () => {
      // Don't poll (or pile up refreshes) while the tab isn't being looked at;
      // the focus listener below catches up the moment it is again.
      if (document.visibilityState !== 'visible') return
      try {
        const since = sinceRef.current
        const query = `path=${encodeURIComponent(pathname)}${since ? `&since=${encodeURIComponent(since)}` : ''}`
        const res = await fetch(`/api/admin/preview/changed?${query}`, {
          cache: 'no-store',
        })
        if (!res.ok || stopped) return
        const data = (await res.json()) as { changed: boolean; now: string }
        if (stopped) return
        sinceRef.current = data.now
        if (data.changed) router.refresh()
      } catch (err) {
        // Transient network failure — the next poll will try again.
        console.warn('preview auto-refresh poll failed:', err)
      }
    }

    const interval = setInterval(tick, POLL_MS)
    tick()

    const onFocus = () => router.refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      stopped = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [pathname, router])

  return null
}
