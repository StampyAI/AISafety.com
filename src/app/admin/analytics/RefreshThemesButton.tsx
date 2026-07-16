'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './analytics.module.css'

/** Owner-only button that regenerates the question themes (one Claude call
 *  server-side, ~10s) and re-renders the dashboard with the fresh summary. */
export default function RefreshThemesButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/analytics/themes', {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.showMoreBtn}
        onClick={run}
        disabled={busy}
      >
        {busy ? 'Summarizing…' : 'Refresh themes'}
      </button>
      {error && <span className={styles.dim}> {error}</span>}
    </>
  )
}
