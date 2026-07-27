'use client'

import { useSyncExternalStore } from 'react'
import { getTrackingOptOut, setTrackingOptOut } from '@/lib/analytics'

// The "exclude this browser" flag lives in localStorage (a browser-only store),
// so we read it through useSyncExternalStore: the sanctioned way to subscribe to
// state outside React, with a clean server snapshot for SSR. The native
// 'storage' event only fires in *other* tabs, so we also keep an in-tab listener
// set and ping it whenever this tab flips the flag. The set is module-level, so
// every control that toggles the flag (the analytics header and the conversation
// log) stays in sync live.
const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  if (typeof window !== 'undefined') window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', cb)
  }
}

/** Reactive "exclude this browser" flag, shared by every admin control that
 *  toggles it. `marker` is the ISO timestamp the browser was excluded (or '' when
 *  it isn't); `optedOut` is the boolean; `setOptOut` flips it and notifies all
 *  in-tab subscribers. The same flag also keeps the browser out of first-party
 *  click analytics and out of the chatbot conversation log. */
export function useTrackingOptOut(): {
  marker: string
  optedOut: boolean
  setOptOut: (next: boolean) => void
} {
  const marker = useSyncExternalStore(subscribe, getTrackingOptOut, () => '')
  const setOptOut = (next: boolean) => {
    setTrackingOptOut(next)
    listeners.forEach(cb => cb())
  }
  return { marker, optedOut: marker !== '', setOptOut }
}

/** Format an ISO timestamp as "22 Jun 2026" (day-month-year, browser-local). */
export function formatExcludedSince(iso: string): string | undefined {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
