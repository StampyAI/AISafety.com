'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { typeForPath, withLiveEntries, type LoadState } from '@/lib/search'
import type { SearchEntry, SearchType } from '@/lib/data/search-index'
import { trackSearchOpen, type SearchOpenMethod } from '@/lib/analytics'
import { PREVIEW_CHANGED_EVENT } from './PreviewAutoRefresh'
import SearchModal from './SearchModal'

interface SearchContextValue {
  open: () => void
  prefetch: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

// Preview mode re-reads on open anything older than this: the prebuilt index
// (whose server copy /api/check-rebuild refreshes within about a minute of an
// Airtable edit, so asking more often gains nothing) and the live entries for
// the page being looked at (which the page's own change poll keeps current in
// between, see below).
const PREVIEW_MAX_AGE_MS = 30_000

/** Preview mode: a live read of the entries for one page, laid over the
 *  prebuilt index while that page is being looked at. */
interface LiveEntries {
  pathname: string
  type: SearchType
  entries: SearchEntry[]
}

export function SearchProvider({
  children,
  counts,
  preview = false,
}: {
  children: ReactNode
  counts?: Partial<Record<string, number>>
  /** True while this browser is in preview mode (src/lib/preview.ts). Search
   *  then keeps up with edits: the entries for the page being looked at are
   *  re-read live, and the prebuilt index is fetched afresh now and then. */
  preview?: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<LoadState>({ status: 'idle' })
  // When the index now in `load` was fetched; null until the first success.
  const fetchedAtRef = useRef<number | null>(null)
  const fetchingRef = useRef(false)
  // Preview mode only. The prebuilt index lags an edit by a minute or two,
  // which is fine for every page but the one being checked — so the entries
  // for that page are re-read live (one table, two for /training) whenever
  // the page itself refreshes for a change, and on open once they are
  // PREVIEW_MAX_AGE_MS old. Kept for one page only: after navigating, the new
  // page's are read on its first open and these are ignored.
  const [live, setLive] = useState<LiveEntries | null>(null)
  const liveAtRef = useRef<{ pathname: string; at: number } | null>(null)
  const liveFetchingRef = useRef(false)
  const triggerElRef = useRef<HTMLElement | null>(null)

  const fetchIndex = useCallback(async () => {
    if (fetchingRef.current) return
    const fetchedAt = fetchedAtRef.current
    const refreshing = fetchedAt !== null
    if (
      refreshing &&
      !(preview && Date.now() - fetchedAt >= PREVIEW_MAX_AGE_MS)
    ) {
      return
    }
    fetchingRef.current = true
    // A preview refresh keeps the index already loaded searchable until the
    // new one lands; only the first load shows the loading state.
    if (!refreshing) setLoad({ status: 'loading' })
    try {
      // Without cookies on purpose. In preview mode the browser's Draft Mode
      // cookie would otherwise make the server rebuild the whole index from
      // live Airtable — a dozen tables at once, well past its rate limit —
      // and search hung for a minute or more. The prebuilt index the public
      // site searches is plenty for finding a listing, and it is refreshed
      // within about a minute of an edit anyway (check-rebuild clears the
      // records cache the moment it notices a change).
      //
      // What preview must skip is the browser's own copy: the response is
      // cached for an hour, so without `no-store` the first search after an
      // edit would keep showing the index from up to an hour ago.
      const res = await fetch('/api/search-index', {
        credentials: 'omit',
        cache: preview ? 'no-store' : 'default',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as unknown
      if (!Array.isArray(body)) {
        throw new Error('Search index response was not an array')
      }
      fetchedAtRef.current = Date.now()
      setLoad({ status: 'ready', index: body as SearchEntry[] })
    } catch (err) {
      if (refreshing) {
        // The index already loaded stays searchable; the next open tries again.
        console.warn('Search index refresh failed:', err)
      } else {
        // fetchedAtRef is still null, so the modal's retry can try again.
        setLoad({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to load',
        })
      }
    } finally {
      fetchingRef.current = false
    }
  }, [preview])

  // Re-reads the entries for the page at `path` unless a read newer than
  // `maxAge` is already in hand. Failures keep the prebuilt entries: the next
  // change or open tries again.
  const fetchLive = useCallback(async (path: string, maxAge: number) => {
    const type = typeForPath(path)
    if (!type || liveFetchingRef.current) return
    const last = liveAtRef.current
    if (last && last.pathname === path && Date.now() - last.at < maxAge) return
    liveFetchingRef.current = true
    try {
      const res = await fetch(
        `/api/admin/preview/search-entries?type=${encodeURIComponent(type)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { type?: unknown; entries?: unknown }
      if (body.type !== type || !Array.isArray(body.entries)) {
        throw new Error('Unexpected search-entries response')
      }
      liveAtRef.current = { pathname: path, at: Date.now() }
      setLive({ pathname: path, type, entries: body.entries as SearchEntry[] })
    } catch (err) {
      console.warn('Live search entries failed:', err)
    } finally {
      liveFetchingRef.current = false
    }
  }, [])

  // The page just re-rendered for a change to its records: re-read its
  // entries in the same breath (the two reads share one Airtable fetch).
  // Only once search has been used on this page — before that, the first
  // open reads them anyway, and an unused search shouldn't cost table reads.
  useEffect(() => {
    if (!preview) return
    const onChanged = (e: Event) => {
      if (fetchedAtRef.current === null) return
      const detail = (e as CustomEvent<{ pathname?: string }>).detail
      fetchLive(detail?.pathname ?? pathname, 0)
    }
    window.addEventListener(PREVIEW_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PREVIEW_CHANGED_EVENT, onChanged)
  }, [preview, pathname, fetchLive])

  const handleOpen = useCallback(
    (method: SearchOpenMethod) => {
      triggerElRef.current = document.activeElement as HTMLElement | null
      fetchIndex()
      if (preview) fetchLive(pathname, PREVIEW_MAX_AGE_MS)
      setOpen(true)
      trackSearchOpen(method)
    },
    [fetchIndex, fetchLive, preview, pathname]
  )

  // What the modal searches: the prebuilt index, with this page's live
  // entries swapped in while in preview mode.
  const loadForModal = useMemo<LoadState>(() => {
    if (
      !preview ||
      load.status !== 'ready' ||
      !live ||
      live.pathname !== pathname
    ) {
      return load
    }
    return {
      status: 'ready',
      index: withLiveEntries(load.index, live.type, live.entries),
    }
  }, [preview, load, live, pathname])

  const handleClose = useCallback(() => {
    setOpen(false)
    // Restore focus so keyboard users land back where they were.
    triggerElRef.current?.focus?.()
  }, [])

  // Capture phase wins against focused-input defaults and extensions.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        e.stopPropagation()
        handleClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) {
          handleClose()
        } else {
          handleOpen('cmd-k')
        }
        return
      }
      if (e.key === '/' && !open) {
        const target = e.target as HTMLElement | null
        const isTyping =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target?.isContentEditable ?? false)
        if (isTyping) return
        e.preventDefault()
        handleOpen('slash')
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, handleOpen, handleClose])

  return (
    <SearchContext.Provider
      // The context's open() is only reachable from the SearchButtons.
      value={{ open: () => handleOpen('button'), prefetch: fetchIndex }}
    >
      {children}
      <SearchModal
        open={open}
        onClose={handleClose}
        load={loadForModal}
        onRetry={fetchIndex}
        pathCounts={counts}
      />
    </SearchContext.Provider>
  )
}

interface SearchButtonProps {
  className?: string
  children: ReactNode
  onClick?: () => void
}

export function SearchButton({
  className,
  children,
  onClick,
}: SearchButtonProps) {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('SearchButton must be used within a SearchProvider')
  }
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.()
        ctx.open()
      }}
      onMouseEnter={ctx.prefetch}
      onFocus={ctx.prefetch}
      className={className}
      aria-label="Search"
    >
      {children}
    </button>
  )
}
