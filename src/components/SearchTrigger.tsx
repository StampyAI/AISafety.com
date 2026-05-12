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
import SearchModal from './SearchModal'

interface SearchContextValue {
  open: () => void
  prefetch: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({
  children,
  counts,
}: {
  children: ReactNode
  counts?: Partial<Record<string, number>>
}) {
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<LoadState>({ status: 'idle' })
  const fetchedRef = useRef(false)
  const triggerElRef = useRef<HTMLElement | null>(null)

  const fetchIndex = useCallback(async () => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    setLoad({ status: 'loading' })
    try {
      const res = await fetch('/api/search-index')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as unknown
      if (!Array.isArray(body)) {
        throw new Error('Search index response was not an array')
      }
      setLoad({ status: 'ready', index: body as SearchEntry[] })
    } catch (err) {
      // Allow retry after error.
      fetchedRef.current = false
      setLoad({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load',
      })
    }
  }, [])

  const handleOpen = useCallback(() => {
    triggerElRef.current = document.activeElement as HTMLElement | null
    fetchIndex()
    setOpen(true)
  }, [fetchIndex])

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
          handleOpen()
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
        handleOpen()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, handleOpen, handleClose])

  return (
    <SearchContext.Provider value={{ open: handleOpen, prefetch: fetchIndex }}>
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
