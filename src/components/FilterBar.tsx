'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './FilterBar.module.css'

interface FilterBarProps {
  /** The FilterDropdown pills. */
  children: ReactNode
  /** Number of results currently shown. */
  count: number
  /** Singular noun for the count, e.g. "course". Pluralized with an "s". */
  noun: string
}

// Horizontal row of filter dropdowns with a result count on the right. Sits
// above the listing grid (replacing the old vertical FilterSidebar) and sticks
// just below the pinned nav once scrolled to, fading in the nav's blurred-teal
// background (see FilterBar.module.css). `stuck` flips when the bar reaches its
// sticky offset, read from the computed `top`.
export default function FilterBar({ children, count, noun }: FilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    let stickyTop = parseFloat(getComputedStyle(bar).top) || 0
    const measure = () => {
      stickyTop = parseFloat(getComputedStyle(bar).top) || 0
    }
    const onScroll = () => {
      setStuck(bar.getBoundingClientRect().top <= stickyTop + 0.5)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div ref={barRef} className={`${styles.bar} ${stuck ? styles.stuck : ''}`}>
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.pills}>{children}</div>
      <p className={`paragraph-small color-teal-300 ${styles.count}`}>
        {count} {noun}
        {count === 1 ? '' : 's'}
      </p>
    </div>
  )
}
