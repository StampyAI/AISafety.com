'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { LoadState } from '@/lib/search'
import type { SearchEntry } from '@/lib/data/search-index'
import { trackSearchOpen, type SearchOpenMethod } from '@/lib/analytics'
import SearchModal from './SearchModal'

interface SearchContextValue {
  open: () => void
  prefetch: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

// In preview mode, an index older than this is fetched again the next time
// search opens (or its button is hovered). The server's copy is refreshed by
// /api/check-rebuild within about a minute of an Airtable edit, so asking
// more often than this would gain nothing.
const PREVIEW_INDEX_MAX_AGE_MS = 30_000

export function SearchProvider({
  children,
  counts,
  preview = false,
}: {
  children: ReactNode
  counts?: Partial<Record<string, number>>
  /** True while this browser is in preview mode (src/lib/preview.ts). Search
   *  then re-fetches its index now and then, so an edit shows up in search
   *  soon after it shows on the page instead of up to an hour later. */
  preview?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<LoadState>({ status: 'idle' })
  // When the index now in `load` was fetched; null until the first success.
  const fetchedAtRef = useRef<number | null>(null)
  const fetchingRef = useRef(false)
  const triggerElRef = useRef<HTMLElement | null>(null)

  const fetchIndex = useCallback(async () => {
    if (fetchingRef.current) return
    const fetchedAt = fetchedAtRef.current
    const refreshing = fetchedAt !== null
    if (
      refreshing &&
      !(preview && Date.now() - fetchedAt >= PREVIEW_INDEX_MAX_AGE_MS)
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

  const handleOpen = useCallback(
    (method: SearchOpenMethod) => {
      triggerElRef.current = document.activeElement as HTMLElement | null
      fetchIndex()
      setOpen(true)
      trackSearchOpen(method)
    },
    [fetchIndex]
  )

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
        load={load}
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
