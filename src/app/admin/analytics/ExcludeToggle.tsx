'use client'

import { useSyncExternalStore } from 'react'
import { getTrackingOptOut, setTrackingOptOut } from '@/lib/analytics'
import styles from './analytics.module.css'

// The opt-out flag lives in localStorage (a browser-only store), so we read it
// through useSyncExternalStore: that's the sanctioned way to subscribe to state
// outside React and it gives a clean server snapshot for SSR. The native
// 'storage' event only fires in *other* tabs, so we also keep an in-tab
// listener set and ping it whenever this tab flips the flag.
const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  if (typeof window !== 'undefined') window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb)
  }
}

function setFlag(next: boolean): void {
  setTrackingOptOut(next)
  listeners.forEach(cb => cb())
}

/** Format an ISO timestamp as "22 Jun 2026" (day-month-year, browser-local). */
function formatSince(iso: string): string | undefined {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Small header control for the owner to keep their own activity out of these
 *  stats on the current browser. Stored in localStorage (set once per device,
 *  not matched on IP — the owner moves countries monthly). It only applies going
 *  forward: when excluded it shows the date it stopped recording this browser,
 *  and earlier visits stay counted. */
export default function ExcludeToggle() {
  const marker = useSyncExternalStore(subscribe, getTrackingOptOut, () => '')
  const optedOut = marker !== ''
  const since = optedOut ? formatSince(marker) : undefined

  if (optedOut) {
    return (
      <span className={styles.excludeMeta}>
        <span
          className={styles.excludeMetaOn}
          title="Only affects visits from now on — earlier visits stay counted."
        >
          ✓ Not recording this browser{since ? ` since ${since}` : ''}
        </span>
        <button
          type="button"
          className={styles.excludeLink}
          onClick={() => setFlag(false)}
        >
          Undo
        </button>
      </span>
    )
  }

  return (
    <span className={styles.excludeMeta}>
      <button
        type="button"
        className={styles.excludeLink}
        onClick={() => setFlag(true)}
      >
        Exclude this browser
      </button>
    </span>
  )
}
