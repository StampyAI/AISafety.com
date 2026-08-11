'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { chipsFor, greetingFor } from '@/lib/assistant/pages'
import { getPageContext } from '@/lib/assistant/page-context'
import { suggestFormUrl } from '@/lib/assistant/constants'
import { trackEvent, isTrackingOptedOut } from '@/lib/analytics'
import type { CitationRef } from '@/lib/assistant/types'
import ChatBody, { type ChatBodyHandle } from './ChatBody'
import Icon from '@/components/Icon'
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

  const fireLog = useCallback(async (event: object) => {
    // The "exclude this browser" switch (privacy page/admin) covers the
    // assistant's open/click/suggest log too, not just conversation turns.
    if (isTrackingOptedOut()) return
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
      // First-party funnel: unique users who open the chatbot. The page and
      // trigger feed the admin dashboard's "where/how it's opened" panels.
      trackEvent('chatbot_open', { page: currentPage })
    },
    [currentPage, fireLog]
  )

  // Funnel: unique users who send the chatbot a message. Fired from the public
  // chatbot only (the admin playground doesn't pass onUserSend), so internal
  // testing never inflates the numbers.
  const handleUserSend = useCallback(() => {
    trackEvent('chatbot_message', { page: currentPage })
  }, [currentPage])

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
    (query: string, type?: string, turnIndex?: number) => {
      void fireLog({
        kind: 'suggest',
        query,
        type,
        turnIndex,
        currentPage,
        sessionId: getSessionId(),
      })
      window.open(suggestFormUrl(type), '_blank', 'noopener')
    },
    [currentPage, fireLog]
  )

  const handleCitationClick = useCallback(
    (c: CitationRef, turnIndex: number) => {
      void fireLog({
        kind: 'click',
        citationId: c.id,
        turnIndex,
        url: c.url,
        currentPage,
        sessionId: getSessionId(),
      })
      // Funnel: unique users who click a result the chatbot surfaced.
      trackEvent('chatbot_click', {
        url: c.url,
        listingId: c.id,
        page: currentPage,
        source: 'card',
      })
    },
    [currentPage, fireLog]
  )

  const handleLinkClick = useCallback(
    (href: string, label: string, turnIndex?: number) => {
      void fireLog({
        kind: 'click',
        target: 'link',
        url: href,
        label,
        turnIndex,
        currentPage,
        sessionId: getSessionId(),
      })
      trackEvent('chatbot_click', {
        url: href,
        label,
        page: currentPage,
        source: 'link',
      })
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
      // When the owner has excluded this browser, tell the server not to log
      // the turn — keeps their own testing out of the conversation log.
      noLog: isTrackingOptedOut() || undefined,
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

  // Focus the message field on open so the user can start typing right away.
  // Desktop only — on touch devices the on-screen keyboard would pop up and
  // cover the greeting and suggestion chips.
  useEffect(() => {
    if (!isOpen) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    chatRef.current?.focusInput()
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        className={`${styles.pill} drop-shadow-dark`}
        onClick={handleTogglePill}
        aria-label={
          isOpen ? 'Close the assistant' : 'Open the AISafety.com assistant'
        }
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <Icon src="/images/icons/chevron-down-xl.svg" size={32} />
        ) : (
          <Icon src="/images/icons/speech-bubble-sparkle-xl.svg" size={32} />
        )}
      </button>

      <div
        className={`${styles.scrim} ${isOpen && isExpanded ? styles.scrimVisible : ''}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <aside
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''} ${isExpanded ? styles.panelExpanded : ''}`}
        role="dialog"
        aria-modal={isExpanded}
        aria-label="AISafety.com directory assistant"
        aria-hidden={!isOpen}
      >
        <header className={styles.header}>
          <div className={styles.headerLabel}>
            <Icon
              src="/images/icons/chat.svg"
              size={16}
              className={styles.headerLabelIcon}
            />
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
                <Icon src="/images/icons/trash.svg" size={16} />
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
                <Icon src="/images/icons/shrink.svg" size={16} />
              ) : (
                <Icon src="/images/icons/expand.svg" size={16} />
              )}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleClose}
              aria-label="Close assistant"
            >
              <Icon src="/images/icons/x.svg" size={16} />
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
