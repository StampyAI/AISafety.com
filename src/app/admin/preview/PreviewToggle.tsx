'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import styles from './preview.module.css'

/** Master switch: shows or hides the floating switch buttons on this
 *  browser. Mode changes themselves happen through those buttons. */
export default function PreviewToggle({ pillsShown }: { pillsShown: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [refreshing, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pills: !pillsShown }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // In-place server re-render with the new cookie state — a full reload
      // flashes the admin page white.
      setBusy(false)
      startTransition(() => router.refresh())
    } catch (err) {
      setBusy(false)
      setError(`Could not switch (${err}). Please try again.`)
    }
  }

  return (
    <span className={styles.toggleWrap}>
      {error && <span className={styles.toggleError}>{error}</span>}
      <button
        type="button"
        className={pillsShown ? styles.buttonOff : styles.buttonOn}
        onClick={toggle}
        disabled={busy || refreshing}
      >
        {busy || refreshing
          ? 'Switching…'
          : pillsShown
            ? 'Hide the switch buttons'
            : 'Show the switch buttons'}
      </button>
    </span>
  )
}
