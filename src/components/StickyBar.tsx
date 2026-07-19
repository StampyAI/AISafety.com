'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './StickyBar.module.css'

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
