'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { formatTimeAgo } from '@/lib/format-date'
import styles from './PreviewBanner.module.css'

/** The preview-side switch pill: shows that this browser is in preview mode
 *  and, when clicked, returns it to the public view. Hidden in the admin —
 *  /admin/preview reports the mode itself, and the other admin screens
 *  aren't part of the site being previewed. */
export default function ExitPreviewButton({
  buildTime,
}: {
  buildTime: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [refreshing, startTransition] = useTransition()
  const [rebuilt, setRebuilt] = useState(() =>
    buildTime ? formatTimeAgo(buildTime, new Date()) : null
  )

  useEffect(() => {
    if (!buildTime) return
    const tick = () => setRebuilt(formatTimeAgo(buildTime, new Date()))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [buildTime])

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
            // The age is recomputed on the client clock every 30 s, so the
            // server-rendered text can be a minute behind at hydration.
            <span className={styles.buildNote} suppressHydrationWarning>
              {' '}
              · public built {rebuilt}
            </span>
          )}
        </>
      )}
    </button>
  )
}
