'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import styles from './PreviewBanner.module.css'

/** The preview-side switch pill: shows that this browser is in preview mode
 *  and, when clicked, returns it to the public view. Hidden in the admin —
 *  /admin/preview reports the mode itself, and the other admin screens
 *  aren't part of the site being previewed. */
export default function ExitPreviewButton({
  rebuilt,
}: {
  rebuilt: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [refreshing, startTransition] = useTransition()

  if (pathname.startsWith('/admin')) return null

  async function exitPreview() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // In-place server re-render — a full reload here makes the page
      // flash white while switching.
      setBusy(false)
      startTransition(() => router.refresh())
    } catch {
      setBusy(false)
      alert('Could not exit preview mode — please try again.')
    }
  }

  return (
    <button
      type="button"
      className={styles.exit}
      onClick={exitPreview}
      disabled={busy || refreshing}
      title="This browser sees live Airtable data — click to switch back to the public view"
    >
      <span className={styles.dot} aria-hidden />
      {busy || refreshing ? (
        'Switching…'
      ) : (
        <>
          Preview
          {rebuilt && (
            <span className={styles.buildNote}> · public built {rebuilt}</span>
          )}
        </>
      )}
    </button>
  )
}
