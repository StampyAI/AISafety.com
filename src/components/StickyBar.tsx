'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './StickyBar.module.css'

// Scroll so `anchor` (an element placed just above a StickyBar) sits at the
// top of the viewport — used when a toggle inside the bar swaps the page's
// content, so the user sees the new set from its top. Never scrolls down.
// Announces the jump first so the nav doesn't treat it as a scroll-up and
// reveal itself over the fresh content. If the nav is ALREADY showing it
// stays, so land the anchor just below it (--nav-offset is its live bottom
// edge, 0 while hidden) — otherwise the bar would pin over the content.
export function scrollToAnchor(anchor: HTMLElement | null) {
  if (!anchor) return
  const navOffset =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--nav-offset'
      )
    ) || 0
  const target = anchor.getBoundingClientRect().top + window.scrollY - navOffset
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
  const barRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const bar = barRef.current
    if (!sentinel || !bar) return
    // Stuck = the bar is pinned away from its natural spot: the sentinel
    // (which marks that spot) has passed above the bar's sticky top line.
    // That line is usually 0 but grows to the nav's bottom edge while the
    // nav is showing — so the bar can be pushed down (and need its backdrop)
    // even before the page has scrolled past it. An IntersectionObserver
    // against the viewport can't see that case.
    const check = () => {
      const stickyTop = parseFloat(getComputedStyle(bar).top) || 0
      setStuck(sentinel.getBoundingClientRect().top < stickyTop)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    // Re-check when the nav publishes a new --nav-offset (set as an inline
    // style on <html> every frame of its slide).
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    })
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      <div
        ref={barRef}
        className={`${styles.bar} ${stuck ? styles.stuck : ''}${className ? ` ${className}` : ''}`}
      >
        {children}
      </div>
    </>
  )
}
