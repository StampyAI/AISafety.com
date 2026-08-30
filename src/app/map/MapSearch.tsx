'use client'

import Image from 'next/image'
import Icon from '@/components/Icon'
import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import SearchBar from '@/components/SearchBar'
import styles from './page.module.css'

export interface MapSearchOrg {
  id: string
  title: string
  tooltipTitle: string
  shortName: string | null
  category: string
  mapLogo: string | null
  x: number | null
  y: number | null
  scale: string | null
}

interface MapSearchProps {
  className: string
  orgs: MapSearchOrg[]
  onPick: (org: MapSearchOrg) => void
  onClear: () => void
}

const MAX_RESULTS = 8

export default function MapSearch({
  className,
  orgs,
  onPick,
  onClear,
}: MapSearchProps) {
  const [query, setQuery] = useState('')
  // Starts as just a round icon button; the input only appears on demand so
  // the map stays uncluttered.
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    // Same ranking as the admin map editor's search: a field starting with
    // the query outranks a mid-word match.
    const prefix: MapSearchOrg[] = []
    const rest: MapSearchOrg[] = []
    for (const org of orgs) {
      const fields = [
        org.title,
        org.shortName ?? '',
        org.tooltipTitle,
        org.category,
      ].map(f => f.toLowerCase())
      if (fields.some(f => f.startsWith(q))) prefix.push(org)
      else if (fields.some(f => f.includes(q))) rest.push(org)
    }
    return [...prefix, ...rest].slice(0, MAX_RESULTS)
  }, [orgs, query])

  const handleChange = (value: string) => {
    setQuery(value)
    setActiveIndex(-1)
    setOpen(value.trim().length > 0)
    if (value.trim() === '') onClear()
  }

  const pick = (org: MapSearchOrg) => {
    setQuery(org.tooltipTitle)
    setOpen(false)
    setActiveIndex(-1)
    onPick(org)
  }

  // Capture phase so list navigation wins over SearchBar's own key handling
  // on the input (its Enter/Escape behavior is built for the cards search).
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      pick(results[activeIndex === -1 ? 0 : activeIndex])
    }
  }

  if (!expanded) {
    return (
      <div className={className}>
        <button
          type="button"
          className={styles['map-search-toggle']}
          title="Search the map"
          aria-label="Search the map"
          onClick={() => setExpanded(true)}
        >
          <Icon
            src="/images/icons/magnifying-glass.svg"
            size={16}
            className="color-white"
          />
        </button>
      </div>
    )
  }

  return (
    <div className={className} onKeyDownCapture={handleKeyDownCapture}>
      <span className={styles['map-search-icon']} aria-hidden="true" />
      <SearchBar
        value={query}
        onChange={handleChange}
        placeholder="Search the map"
        className={styles['map-search-input']}
        autoFocus
        onFocus={() => setOpen(query.trim().length > 0)}
        onBlur={() => {
          setOpen(false)
          setActiveIndex(-1)
          // Nothing typed or picked — shrink back to the icon.
          if (query.trim() === '') setExpanded(false)
        }}
      />
      {open && (
        <div className={styles['map-search-results']} role="listbox">
          {results.map((org, i) => (
            <button
              key={org.id}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              className={`${styles['map-search-row']}${
                i === activeIndex ? ` ${styles['map-search-row-active']}` : ''
              }`}
              // Mousedown, not click: picking must beat the input's blur,
              // which closes this list before a click would land.
              onMouseDown={event => {
                event.preventDefault()
                pick(org)
              }}
            >
              <span className={styles['map-search-logo']}>
                {org.mapLogo && (
                  <Image
                    src={org.mapLogo}
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    onError={e => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
              </span>
              <span className={styles['map-search-name']}>
                {org.tooltipTitle}
              </span>
              <span className={styles['map-search-category']}>
                {org.category.split(',')[0].trim()}
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <div className={styles['map-search-empty']}>Nothing found.</div>
          )}
        </div>
      )}
    </div>
  )
}
