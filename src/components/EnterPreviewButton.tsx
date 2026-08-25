'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import styles from './PreviewBanner.module.css'

/** Small "Switch to preview" pill on the public pages, so an editor can jump
 *  into preview mode from wherever they are instead of via /admin/preview.
 *  Server-side it always renders nothing (public pages stay byte-identical);
 *  after mounting it shows itself only when the switch pills are turned on
 *  at /admin/preview, which sets the JS-readable cookie
 *  aisafety_preview_pills (see setPreviewPillsCookie in
 *  src/lib/admin/auth.ts). The cookie is cosmetic: enabling still goes
 *  through the server-side capability check. Hidden on /admin, which has the
 *  master switch. */
export default function EnterPreviewButton() {
  const pathname = usePathname()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refreshing, startTransition] = useTransition()

  useEffect(() => {
    setVisible(document.cookie.split('; ').includes('aisafety_preview_pills=1'))
  }, [])

  if (!visible || pathname.startsWith('/admin')) return null

  async function enterPreview() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // In-place server re-render — a full reload here makes the page
      // flash white while switching.
      setBusy(false)
      startTransition(() => router.refresh())
    } catch {
      setBusy(false)
      alert(
        'Could not switch to preview mode — your admin sign-in may have expired.'
      )
    }
  }

  return (
    <button
      type="button"
      className={styles.enter}
      onClick={enterPreview}
      disabled={busy || refreshing}
      title="See this page with live Airtable data (only affects your browser)"
    >
      {busy || refreshing ? 'Switching…' : 'Switch to preview'}
    </button>
  )
}
