'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SearchEntry, SearchType } from '@/lib/data/search-index'
import {
  BROWSE_TYPES,
  TYPE_ICON,
  TYPE_LABEL,
  countsByType,
  groupByType,
  search,
  type LoadState,
} from '@/lib/search'
import styles from './SearchModal.module.css'

interface SearchModalProps {
  open: boolean
  onClose: () => void
  load: LoadState
  onRetry: () => void
  pathCounts?: Partial<Record<string, number>>
}

export default function SearchModal({
  open,
  onClose,
  load,
  onRetry,
  pathCounts,
}: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [activeType, setActiveType] = useState<SearchType | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  // Suppresses mouse-move stealing the active row right after a key nav.
  const lastKeyNavRef = useRef(0)
  // Mirrored to refs so the keydown listener reads fresh values without
  // re-registering on every keystroke.
  const resultsArrRef = useRef<SearchEntry[]>([])
  const activeIndexRef = useRef(0)
  const activeTypeRef = useRef<SearchType | null>(null)
  const queryRef = useRef('')

  useEffect(() => {
    // createPortal needs document.body, which only exists after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const index = load.status === 'ready' ? load.index : null

  const results = useMemo(
    () => (index ? search(index, query, activeType) : []),
    [index, query, activeType]
  )
  const grouped = useMemo(() => groupByType(results), [results])
  // Use the same server-rendered counts the nav shows so the two
  // always agree. The search-index counts drift by ±1-2 vs the nav
  // because of view filters; that mismatch is more confusing than
  // a perfectly-accurate-but-different number is useful.
  const counts = useMemo(
    () =>
      pathCounts ? countsByType(pathCounts) : new Map<SearchType, number>(),
    [pathCounts]
  )

  useEffect(() => {
    resultsArrRef.current = results
    activeIndexRef.current = activeIndex
    activeTypeRef.current = activeType
    queryRef.current = query
  })

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when modal transitions open/closed
      setActiveIndex(0)
    } else {
      setQuery('')
      setActiveType(null)
    }
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [activeType, open])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset highlighted row when filter/query changes
    setActiveIndex(0)
  }, [query, activeType])

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Esc lives in SearchProvider so it wins against anything inside the modal.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        lastKeyNavRef.current = Date.now()
        setActiveIndex(i => Math.min(i + 1, resultsArrRef.current.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        lastKeyNavRef.current = Date.now()
        setActiveIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        // On touch devices the soft keyboard's Go/Return key fires Enter.
        // Dismiss the keyboard instead of opening the active result —
        // mobile users tap to navigate, not Enter.
        if (!window.matchMedia('(hover: hover)').matches) {
          e.preventDefault()
          inputRef.current?.blur()
          return
        }
        const target = resultsArrRef.current[activeIndexRef.current]
        if (target) {
          e.preventDefault()
          // Click the rendered <a> instead of window.open / location.href —
          // ad blockers (AdGuard et al) silently swallow programmatic
          // window.open calls. A synthetic anchor click inherits target=_blank
          // from the link itself and is treated as a real user navigation.
          const link = resultsRef.current?.querySelector<HTMLAnchorElement>(
            `[data-result-index="${activeIndexRef.current}"]`
          )
          if (link) {
            link.click()
          } else {
            window.location.href = target.url
          }
        }
      } else if (
        e.key === 'Backspace' &&
        queryRef.current === '' &&
        activeTypeRef.current
      ) {
        e.preventDefault()
        setActiveType(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    const container = resultsRef.current
    if (!container) return
    const active = container.querySelector<HTMLElement>(
      `[data-result-index="${activeIndex}"]`
    )
    if (active) {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  if (!open || !mounted) return null

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const trimmedQuery = query.trim()
  const isReady = load.status === 'ready'
  // Render structure during load to avoid a flash between states.
  const showBrowseGrid = !activeType && trimmedQuery === ''
  const showNoResults =
    isReady &&
    results.length === 0 &&
    (trimmedQuery !== '' || activeType !== null)
  const showError = load.status === 'error'

  return createPortal(
    <div
      className={`${styles.overlay} backdrop-blur flex justify-center items-start`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Search AISafety.com"
    >
      <div className={`${styles.modal} drop-shadow-dark flex flex-col`}>
        <div
          className={`${styles['input-row']} flex items-center gap-12px padding-top-16px padding-bottom-16px padding-left-24px padding-right-24px`}
        >
          <SearchIcon />
          {activeType && (
            <button
              type="button"
              className={`${styles['filter-chip']} paragraph-xs-bold inline-flex items-center gap-8px padding-top-4px padding-bottom-4px padding-left-12px padding-right-8px`}
              onClick={() => setActiveType(null)}
              aria-label={`Remove ${TYPE_LABEL[activeType]} filter`}
            >
              <span>{TYPE_LABEL[activeType]}</span>
              <CloseIcon />
            </button>
          )}
          <input
            ref={inputRef}
            // type=search suppresses iOS's password/contact autofill bar,
            // which otherwise pops in on refocus and feels like a zoom.
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={
              activeType
                ? `Search in ${TYPE_LABEL[activeType]}…`
                : 'Search all resource pages…'
            }
            className={`${styles.input} color-white`}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onClose}
            className={`${styles['shortcut-hint']} paragraph-xs color-teal-400`}
            aria-label="Close search"
          >
            <span className={styles['shortcut-hint-esc']}>esc</span>
            <span className={styles['shortcut-hint-x']} aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1.5 1.5L8.5 8.5M1.5 8.5L8.5 1.5"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </span>
          </button>
        </div>

        <div
          className={`${styles.results} padding-top-8px padding-bottom-8px padding-left-8px padding-right-8px`}
          ref={resultsRef}
        >
          {showError && (
            <div
              className={`${styles.empty} flex flex-col items-center gap-16px padding-top-32px padding-bottom-32px padding-left-24px padding-right-24px`}
            >
              <p className="paragraph-small color-teal-400">
                Search is temporarily unavailable.
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="button-secondary"
              >
                Try again
              </button>
            </div>
          )}

          {showBrowseGrid && (
            <div className={styles['browse-grid']}>
              {BROWSE_TYPES.map(type => {
                const icon = TYPE_ICON[type]
                const count = counts.get(type) ?? 0
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={`${styles['browse-card']} flex items-center gap-12px padding-top-8px padding-bottom-8px padding-left-8px padding-right-12px cursor-pointer`}
                    disabled={count === 0}
                  >
                    <div
                      className={`${styles['browse-card-icon']} drop-shadow-light flex items-center justify-center`}
                    >
                      {icon && (
                        <Image src={icon} alt="" width={14} height={14} />
                      )}
                    </div>
                    <span
                      className={`${styles['browse-card-title']} paragraph-small-bold`}
                    >
                      {TYPE_LABEL[type]}
                    </span>
                    {count > 0 && (
                      <span
                        className={`${styles['browse-card-count']} paragraph-xs-bold`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {showNoResults && (
            <div
              className={`${styles.empty} padding-top-32px padding-bottom-32px padding-left-24px padding-right-24px`}
            >
              <p className="paragraph-small color-teal-400">
                {activeType
                  ? `No ${TYPE_LABEL[activeType].toLowerCase()} match “${query}”.`
                  : `No results for “${query}”.`}
              </p>
            </div>
          )}

          {grouped.map(([type, items]) => (
            <div key={type} className="margin-bottom-4px">
              {!activeType && (
                <div
                  className={`${styles['group-label']} paragraph-xs-bold flex items-center gap-8px padding-top-16px padding-bottom-8px padding-left-12px padding-right-12px`}
                >
                  <span>{TYPE_LABEL[type]}</span>
                  <span className={styles['group-count']}>{items.length}</span>
                </div>
              )}
              {items.map(entry => {
                const flatIndex = results.indexOf(entry)
                const isExternal = /^https?:|^mailto:/i.test(entry.url)
                const showSubtitle = !!entry.subtitle
                return (
                  <a
                    key={`${entry.type}-${entry.title}-${flatIndex}`}
                    data-result-index={flatIndex}
                    href={entry.url}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    onMouseMove={() => {
                      if (Date.now() - lastKeyNavRef.current < 300) return
                      setActiveIndex(flatIndex)
                    }}
                    className={`${styles.result} ${
                      flatIndex === activeIndex ? styles['result-active'] : ''
                    } flex items-start gap-12px padding-top-12px padding-bottom-12px padding-left-12px padding-right-12px cursor-pointer`}
                  >
                    <ResultIcon entry={entry} />
                    <div className={styles['result-body']}>
                      <p
                        className={`${styles['result-title']} paragraph-small-bold`}
                      >
                        {entry.title}
                      </p>
                      {showSubtitle && (
                        <p
                          className={`${styles['result-subtitle']} paragraph-xs-bold`}
                        >
                          {entry.subtitle}
                        </p>
                      )}
                      {entry.description && (
                        <p
                          className={`${styles['result-description']} paragraph-xs color-teal-300 margin-top-4px`}
                        >
                          {entry.description}
                        </p>
                      )}
                      {entry.category && (
                        <p
                          className={`${styles['result-category']} paragraph-xs margin-top-4px`}
                        >
                          {entry.category}
                        </p>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function ResultIcon({ entry }: { entry: SearchEntry }) {
  const [errored, setErrored] = useState(false)

  if (entry.type === 'page' && entry.logo) {
    return (
      <div
        className={`${styles['result-icon']} ${styles['result-icon-page']} drop-shadow-light flex items-center justify-center`}
      >
        <Image src={entry.logo} alt="" width={18} height={18} />
      </div>
    )
  }

  if (entry.logo && !errored) {
    return (
      <div
        className={`${styles['result-icon']} ${styles['result-icon-logo']} flex items-center justify-center`}
      >
        <Image
          src={entry.logo}
          alt=""
          width={40}
          height={40}
          onError={() => setErrored(true)}
          unoptimized={!entry.logo.startsWith('/')}
        />
      </div>
    )
  }

  const initials = entry.title
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <div
      className={`${styles['result-icon']} ${styles['result-icon-initials']} paragraph-xs-bold flex items-center justify-center`}
    >
      {initials}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      className={`${styles['input-icon']} color-teal-400`}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13.5 13.5L17 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 2L8 8M2 8L8 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
