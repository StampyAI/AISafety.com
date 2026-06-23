'use client'

import { useSyncExternalStore } from 'react'
import { isTrackingOptedOut, setTrackingOptOut } from '@/lib/analytics'
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

/** One-time control for the owner to keep their own activity out of these stats
 *  on the current browser. The choice is stored in this browser's localStorage
 *  (not matched on IP — the owner moves countries monthly, so an IP filter
 *  wouldn't stick), so it's set once per device. It also shows whether *this*
 *  device is currently excluded, since that state is otherwise invisible. */
export default function ExcludeToggle() {
  const optedOut = useSyncExternalStore(
    subscribe,
    () => isTrackingOptedOut(), // client: read the flag from localStorage
    () => false // server: no localStorage, assume counted
  )

  return (
    <div className={styles.excludeRow}>
      {optedOut ? (
        <>
          <span className={styles.excludeStatusOn}>
            ✓ This browser is excluded from these stats.
          </span>
          <button
            type="button"
            className={styles.excludeUndo}
            onClick={() => setFlag(false)}
          >
            Undo
          </button>
        </>
      ) : (
        <>
          <span className={styles.excludeStatus}>
            This browser is counted in these stats.
          </span>
          <button
            type="button"
            className={styles.clickToggleBtn}
            onClick={() => setFlag(true)}
          >
            Exclude this browser
          </button>
        </>
      )}
    </div>
  )
}
