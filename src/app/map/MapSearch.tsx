'use client'

import Image from 'next/image'
import Icon from '@/components/Icon'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MutableRefObject } from 'react'
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
  suggestEntryUrl: string
  onPick: (org: MapSearchOrg) => void
  onClear: () => void
  // The map fills this in so a tap on bare map can shut the search.
  closeRef?: MutableRefObject<() => void>
}

const MAX_RESULTS = 5

// Mirrors map-search-collapse in page.module.css — the field has to stay
// mounted for the shrink, so this is how long we wait before removing it.
const COLLAPSE_MS = 80

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MapSearch({
  className,
  orgs,
  suggestEntryUrl,
  onPick,
  onClear,
  closeRef,
}: MapSearchProps) {
  const [query, setQuery] = useState('')
  // Starts as just a round icon button; the input only appears on demand so
  // the map stays uncluttered.
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // The field shrinks back into the icon before it is removed; `closing` is
  // that in-between beat. It stays `expanded` until the animation is done.
  const [closing, setClosing] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openSearch = () => {
    // Cancels a shrink already in flight, so a quick close-then-open reopens
    // the same field instead of leaving it half-collapsed.
    setClosing(false)
    setExpanded(true)
  }

  const collapse = () => {
    // The ring belongs to the open search — it should not go on pulsing over
    // the map once the field is gone. Every way of closing lands here.
    onClear()
    setOpen(false)
    setActiveIndex(-1)
    if (prefersReducedMotion()) {
      setExpanded(false)
      return
    }
    setClosing(true)
  }

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => {
      setExpanded(false)
      setClosing(false)
    }, COLLAPSE_MS)
    return () => window.clearTimeout(timer)
  }, [closing])

  // Re-registered on every render so the map always calls the current
  // closure rather than one holding stale state.
  useEffect(() => {
    if (!closeRef) return
    closeRef.current = () => {
      if (!expanded) return
      // Dismisses the on-screen keyboard as well as clearing focus.
      inputRef.current?.blur()
      setQuery('')
      collapse()
    }
  })

  // Cmd/Ctrl+F opens this box instead of the browser's find bar. Over the map
  // find-in-page has nothing to work with — the listing names are drawn into
  // the SVG, and it cannot pan or zoom to a match — so taking the shortcut is
  // an upgrade. Down in the cards every name is real text, so we leave it be.
  // ('/' is not ours to take: SearchTrigger binds it for the site search.)
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'f') return
      // Only while the control is actually on screen — once it has scrolled
      // away with the map, the cards are what the visitor is reading. If the
      // viewport height can't be read, keep the shortcut rather than silently
      // doing nothing.
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight
      if (viewportH > 0 && (rect.bottom <= 0 || rect.top >= viewportH)) return
      event.preventDefault()
      openSearch()
      // On the first press the input does not exist yet (collapsed is just the
      // icon button), so focus after React has rendered it.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    // Same ranking as the admin map editor's search: a field starting with
    // the query outranks a mid-word match.
    const prefix: MapSearchOrg[] = []
    const rest: MapSearchOrg[] = []
    for (const org of orgs) {
      // title is the 'Long name for cards' field, which carries bracketed
      // acronyms like "(CARMA)" — so acronym queries match real data.
      const fields = [org.title, org.shortName ?? '', org.tooltipTitle].map(f =>
        f.toLowerCase()
      )
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
    setQuery(org.title)
    setOpen(false)
    setActiveIndex(-1)
    onPick(org)
  }

  // Capture phase so list navigation wins over SearchBar's own key handling
  // on the input (its Enter/Escape behavior is built for the cards search).
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    // ESC on an empty box closes it back to the icon. With text in the box,
    // SearchBar's own ESC handling clears it first — so ESC-ESC fully closes.
    if (event.key === 'Escape' && query.trim() === '') {
      event.preventDefault()
      event.stopPropagation()
      collapse()
      return
    }
    if (!open || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      // Wraps: down from the last result returns to the first.
      setActiveIndex(i => (i + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      setActiveIndex(i => (i <= 0 ? results.length - 1 : i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      pick(results[activeIndex === -1 ? 0 : activeIndex])
    }
  }

  if (!expanded) {
    return (
      <div ref={rootRef} className={className}>
        <button
          type="button"
          className={styles['map-search-toggle']}
          title="Search the map"
          aria-label="Search the map"
          onClick={openSearch}
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
    <div
      ref={rootRef}
      className={className}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <span className={styles['map-search-icon']} aria-hidden="true" />
      <SearchBar
        value={query}
        onChange={handleChange}
        inputRef={inputRef}
        placeholder="Search the map…"
        className={`${styles['map-search-input']}${
          closing ? ` ${styles['map-search-input-closing']}` : ''
        }`}
        autoFocus
        onFocus={() => setOpen(query.trim().length > 0)}
        onBlur={() => {
          setOpen(false)
          setActiveIndex(-1)
          // Nothing typed or picked — shrink back to the icon.
          if (query.trim() === '') collapse()
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
                    width={28}
                    height={28}
                    unoptimized
                    onError={e => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
              </span>
              <span className={styles['map-search-text']}>
                <span className={styles['map-search-name']}>{org.title}</span>
                <span className={styles['map-search-category']}>
                  {org.category.split(',')[0].trim()}
                </span>
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <div className={styles['map-search-empty']}>
              Nothing found.{' '}
              <a
                href={suggestEntryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles['map-search-suggest']}
                // Keep the input's blur from closing the list before the
                // click lands (same trick as the result rows).
                onMouseDown={event => event.preventDefault()}
              >
                Suggest a listing
              </a>
              .
            </div>
          )}
        </div>
      )}
    </div>
  )
}
