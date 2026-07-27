'use client'

import { useTrackingOptOut, formatExcludedSince } from '@/lib/useTrackingOptOut'
import styles from './analytics.module.css'

/** Small header control for the owner to keep their own activity out of these
 *  stats on the current browser. Stored in localStorage (set once per device,
 *  not matched on IP — the owner moves countries monthly). It only applies going
 *  forward: when excluded it shows the date it stopped recording this browser,
 *  and earlier visits stay counted. The same flag also keeps this browser out of
 *  the chatbot conversation log. */
export default function ExcludeToggle() {
  const { marker, optedOut, setOptOut } = useTrackingOptOut()
  const since = optedOut ? formatExcludedSince(marker) : undefined

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
          onClick={() => setOptOut(false)}
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
        onClick={() => setOptOut(true)}
      >
        Exclude this browser
      </button>
    </span>
  )
}
