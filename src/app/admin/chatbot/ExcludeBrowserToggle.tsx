'use client'

import { useTrackingOptOut, formatExcludedSince } from '@/lib/useTrackingOptOut'
import styles from '../admin.module.css'

/** Filter-row control for the owner to keep their own test chats out of the
 *  conversation log on the current browser. Shares the one "exclude this browser"
 *  flag (localStorage) with the analytics dashboard, so a browser excluded in
 *  either place is excluded from both. Forward-only: chats already logged stay,
 *  new chats from this browser stop being recorded. */
export default function ExcludeBrowserToggle() {
  const { marker, optedOut, setOptOut } = useTrackingOptOut()
  const since = optedOut ? formatExcludedSince(marker) : undefined

  if (optedOut) {
    return (
      <span className={styles.excludeMeta}>
        <span
          className={styles.excludeMetaOn}
          title="Only affects chats from now on — chats already logged stay."
        >
          ✓ Not logging this browser{since ? ` since ${since}` : ''}
        </span>
        <button
          type="button"
          className={styles.excludeLink}
          onClick={() => setOptOut(false)}
        >
          Undo
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      className={styles.excludeLink}
      onClick={() => setOptOut(true)}
      title="Stop logging chats from this browser, so your own testing doesn't clutter the log."
    >
      Exclude this browser
    </button>
  )
}
