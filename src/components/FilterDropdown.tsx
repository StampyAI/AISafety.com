'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './FilterDropdown.module.css'

interface FilterDropdownProps {
  title: string
  options: string[]
  selected: string[]
  counts: Record<string, number>
  onToggle: (value: string) => void
  /** Optional 16×16 svg icon (path in /images) shown before the label. */
  icon?: string
}

// A single pill-shaped filter that opens a checkbox popover. Used in the
// horizontal FilterBar on the data-driven sub-pages.
export default function FilterDropdown({
  title,
  options,
  selected,
  counts,
  onToggle,
  icon,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const label =
    selected.length === 0
      ? title
      : selected.length === 1
        ? `${title}: ${selected[0]}`
        : `${title}: ${selected[0]} +${selected.length - 1}`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`${styles.pill} surface paragraph-xs-bold${selected.length > 0 ? ` ${styles.pillActive}` : ''}${
          open ? ` ${styles.pillOpen}` : ''
        }`}
        onClick={() => setOpen(o => !o)}
      >
        {icon && <Image src={icon} alt="" width={16} height={16} unoptimized />}
        {label}
        <svg
          className={styles.chevron}
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6L8 10L12 6" />
        </svg>
      </button>

      {open && (
        <div className={`${styles.popover} surface drop-shadow-dark`}>
          <div className="flex flex-col gap-16px">
            {options.map(option => (
              <label
                key={option}
                className={`flex items-center cursor-pointer ${styles.option}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onToggle(option)}
                  className="checkbox"
                />
                <span className="paragraph-small color-white">
                  {option}
                  <span className="filter-count"> ({counts[option] || 0})</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
