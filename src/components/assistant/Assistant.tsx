'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { chipsFor, greetingFor } from '@/lib/assistant/pages'
import { getPageContext } from '@/lib/assistant/page-context'
import { suggestFormUrl } from '@/lib/assistant/constants'
import { trackEvent } from '@/lib/analytics'
import type { CitationRef } from '@/lib/assistant/types'
import ChatBody, { type ChatBodyHandle } from './ChatBody'
import styles from './Assistant.module.css'

const STORAGE_KEY = 'aisafety-assistant-messages-v3'
const SESSION_KEY = 'aisafety-assistant-session-v1'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return `s-${Date.now()}`
  }
}

function captureUtm(): Record<string, string> | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const out: Record<string, string> = {}
  for (const [k, v] of url.searchParams.entries()) {
    if (k.startsWith('utm_') || k === 'ref' || k === 'src') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

interface GeoFallback {
  city?: string
  region?: string
  country?: string
}

const GEO_CACHE_KEY = 'aisafety-assistant-geo-v1'
let geoFallbackCache: GeoFallback | null | undefined

async function fetchGeoFallback(): Promise<GeoFallback | null> {
  if (geoFallbackCache !== undefined) return geoFallbackCache
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY)
    if (cached) {
      geoFallbackCache = JSON.parse(cached) as GeoFallback
      return geoFallbackCache
    }
  } catch (err) {
    console.warn('[assistant] geo cache read failed', err)
  }
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'force-cache' })
    if (!res.ok) {
      console.warn('[assistant] ipapi returned', res.status)
      geoFallbackCache = null
      return null
    }
    const data = await res.json()
    const geo: GeoFallback = {
      city: typeof data.city === 'string' ? data.city : undefined,
      region: typeof data.region === 'string' ? data.region : undefined,
      country:
        typeof data.country_code === 'string' ? data.country_code : undefined,
    }
    geoFallbackCache = geo
    try {
      sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo))
    } catch (err) {
      console.warn('[assistant] geo cache write failed', err)
    }
    return geo
  } catch (err) {
    console.warn('[assistant] geo lookup failed', err)
    geoFallbackCache = null
    return null
  }
}

export default function Assistant() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasMessages, setHasMessages] = useState(false)
  const chatRef = useRef<ChatBodyHandle>(null)

  const currentPage = pathname || '/'
  const chips = useMemo(() => chipsFor(currentPage), [currentPage])
  const greeting = useMemo(() => greetingFor(currentPage), [currentPage])
  // /map has fixed bottom-right zoom controls; shift pill+panel left to clear.
  const shiftedRight = currentPage === '/map'

  const fireLog = useCallback(async (event: object) => {
    try {
      await fetch('/api/assistant/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true,
      })
    } catch (err) {
      console.warn('[assistant] log post failed', err)
    }
  }, [])

  const handleOpen = useCallback(
    (trigger: 'pill' | 'chip' | 'keyboard') => {
      setIsOpen(true)
      void fireLog({ kind: 'open', trigger, currentPage })
      // First-party funnel: unique users who open the chatbot.
      trackEvent('chatbot_open')
    },
    [currentPage, fireLog]
  )

  // Funnel: unique users who send the chatbot a message. Fired from the public
  // chatbot only (the admin playground doesn't pass onUserSend), so internal
  // testing never inflates the numbers.
  const handleUserSend = useCallback(() => {
    trackEvent('chatbot_message')
  }, [])

  const handleTogglePill = useCallback(() => {
    if (isOpen) {
      setIsOpen(false)
      setIsExpanded(false)
    } else {
      handleOpen('pill')
    }
  }, [isOpen, handleOpen])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setIsExpanded(false)
  }, [])

  const handleSuggest = useCallback(
    (query: string, type?: string) => {
      void fireLog({ kind: 'suggest', query, currentPage })
      window.open(suggestFormUrl(type), '_blank', 'noopener')
    },
    [currentPage, fireLog]
  )

  const handleCitationClick = useCallback(
    (c: CitationRef) => {
      void fireLog({
        kind: 'click',
        citationId: c.id,
        url: c.url,
        currentPage,
        sessionId: getSessionId(),
      })
      // Funnel: unique users who click a result the chatbot surfaced.
      trackEvent('chatbot_click', { url: c.url, listingId: c.id })
    },
    [currentPage, fireLog]
  )

  const handleLinkClick = useCallback(
    (href: string, label: string) => {
      void fireLog({
        kind: 'click',
        target: 'link',
        url: href,
        label,
        currentPage,
        sessionId: getSessionId(),
      })
      trackEvent('chatbot_click', { url: href, label })
    },
    [currentPage, fireLog]
  )

  const handleClear = useCallback(() => {
    chatRef.current?.clear()
    setHasMessages(false)
  }, [])

  const buildBodyExtras = useCallback(async () => {
    const pageCtx = getPageContext()
    const referrer =
      typeof document !== 'undefined' && document.referrer
        ? document.referrer
        : null
    const utm = captureUtm()
    const geoFallback = await fetchGeoFallback()
    return {
      currentPage,
      pageState: pageCtx
        ? {
            page: pageCtx.page,
            ...(pageCtx.filters ? { filters: pageCtx.filters } : {}),
            ...(pageCtx.search ? { search: pageCtx.search } : {}),
          }
        : null,
      referrer,
      utm,
      geoFallback,
      sessionId: getSessionId(),
    }
  }, [currentPage])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  return (
    <>
      <button
        type="button"
        className={`${styles.pill} drop-shadow-dark ${shiftedRight ? styles.pillShifted : ''}`}
        onClick={handleTogglePill}
        aria-label={
          isOpen ? 'Close the assistant' : 'Open the AISafety.com assistant'
        }
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg
            className={styles.pillIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        ) : (
          <svg
            className={styles.pillIcon}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 3C6.48 3 2 6.92 2 11.5c0 2.06.93 3.93 2.46 5.36-.16 1.13-.6 2.7-1.46 3.6-.13.13-.06.34.12.36 1.66.18 3.84-.43 5.4-1.27.95.27 1.95.45 3.48.45 5.52 0 10-3.92 10-8.5S17.52 3 12 3z" />
          </svg>
        )}
      </button>

      <div
        className={`${styles.scrim} ${isOpen && isExpanded ? styles.scrimVisible : ''}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''} ${isExpanded ? styles.panelExpanded : ''} ${shiftedRight && !isExpanded ? styles.panelShifted : ''}`}
        role="dialog"
        aria-modal={isExpanded}
        aria-label="AISafety.com directory assistant"
        aria-hidden={!isOpen}
      >
        <header className={styles.header}>
          <div className={styles.headerLabel}>
            <svg
              className={styles.headerLabelIcon}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 3C6.48 3 2 6.92 2 11.5c0 2.06.93 3.93 2.46 5.36-.16 1.13-.6 2.7-1.46 3.6-.13.13-.06.34.12.36 1.66.18 3.84-.43 5.4-1.27.95.27 1.95.45 3.48.45 5.52 0 10-3.92 10-8.5S17.52 3 12 3z" />
            </svg>
            <span>Chatbot (beta)</span>
          </div>
          <div className={styles.headerActions}>
            {hasMessages && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={handleClear}
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`${styles.iconButton} ${styles.expandButton}`}
              onClick={() => setIsExpanded(v => !v)}
              aria-label={isExpanded ? 'Shrink assistant' : 'Expand assistant'}
              title={isExpanded ? 'Shrink' : 'Expand'}
            >
              {isExpanded ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleClose}
              aria-label="Close assistant"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        <ChatBody
          ref={chatRef}
          endpoint="/api/assistant"
          bodyExtras={buildBodyExtras}
          chips={chips}
          greeting={greeting}
          storageKey={STORAGE_KEY}
          onSuggest={handleSuggest}
          onCitationClick={handleCitationClick}
          onLinkClick={handleLinkClick}
          onUserSend={handleUserSend}
          onHasMessagesChange={setHasMessages}
          resizeKey={`${isOpen}-${isExpanded}`}
        />
      </aside>
    </>
  )
}
