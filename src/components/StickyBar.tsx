'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './StickyBar.module.css'

// Scroll so `anchor` (an element placed just above a StickyBar) sits at the
// top of the viewport — used when a toggle inside the bar swaps the page's
// content, so the user sees the new set from its top. Never scrolls down.
// Announces the jump first so the nav doesn't treat it as a scroll-up and
// reveal itself over the fresh content.
export function scrollToAnchor(anchor: HTMLElement | null) {
  if (!anchor) return
  const target = anchor.getBoundingClientRect().top + window.scrollY
  if (window.scrollY > target) {
    window.dispatchEvent(new Event('stickybar:scroll-jump'))
    window.scrollTo(0, Math.max(0, target))
  }
}

// Sticks its children to the top of the viewport once the page scrolls past
// them (used for the events/training mode toggles). Slides down below the
// global nav when that reveals on scroll-up — the nav publishes its overlay
// height as --nav-offset. The translucent backdrop only appears while the
// bar is actually stuck, so it doesn't show as a band in the page flow.
export default function StickyBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) =>
      // Stuck once the sentinel has left past the TOP of the viewport —
      // leaving past the bottom (page load, before scrolling) doesn't count.
      setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      <div
        className={`${styles.bar} ${stuck ? styles.stuck : ''}${className ? ` ${className}` : ''}`}
      >
        {children}
      </div>
    </>
  )
}
