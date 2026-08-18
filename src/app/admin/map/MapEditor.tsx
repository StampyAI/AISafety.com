'use client'

/*
  Admin map editor controller: loads records live from /api/admin/map, keeps
  the optimistic local positions, runs a one-at-a-time save queue (later moves
  of the same record replace the queued one), holds the undo stack, and wires
  keyboard shortcuts. The canvas (d3) and side panel are dumb views.
*/

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorRecord } from '@/lib/admin/map-editor-core'
import { clampGrid, roundGrid } from '@/lib/admin/map-geometry'
import type { CanvasControls } from './MapEditorCanvas'
import SidePanel, { type PanelTab } from './SidePanel'
import adminStyles from '../admin.module.css'
import styles from './map-editor.module.css'

const MapEditorCanvas = dynamic(() => import('./MapEditorCanvas'), {
  ssr: false,
  loading: () => (
    <div className={`${styles.canvas} ${styles.canvasLoading}`}>
      <p className="paragraph-small color-teal-300">Loading map…</p>
    </div>
  ),
})

type Position = { x: number | null; y: number | null }

interface Status {
  kind: 'idle' | 'saving' | 'ok' | 'stale' | 'error'
  text: string
}

interface UndoEntry {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  at: number
}

interface QueuedMove {
  id: string
  x: number
  y: number
  /** True for undo writes, which must not push another undo entry. */
  isUndo: boolean
}

/** Consecutive nudges/drops of the same pin within this window collapse into
 *  one undo step. */
const UNDO_MERGE_MS = 1500
/** Re-read Airtable when the tab regains focus after this long away. */
const REFRESH_ON_FOCUS_MS = 60_000

function fmt(n: number): string {
  return n.toFixed(1)
}

export default function MapEditor() {
  const [records, setRecords] = useState<EditorRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placeModeId, setPlaceModeId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' })
  const [errorBanner, setErrorBanner] = useState<{
    text: string
    retry: QueuedMove | null
  } | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [showDrafts, setShowDrafts] = useState(true)
  const [showFurniture, setShowFurniture] = useState(true)
  const [previewPublic, setPreviewPublic] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [panelTab, setPanelTab] = useState<PanelTab>('unplaced')

  const controlsRef = useRef<CanvasControls>({
    zoomIn: () => {},
    zoomOut: () => {},
    reset: () => {},
  })
  // What Airtable last confirmed for each record — the `expected` value sent
  // with every write, and where a pin goes back to when a save fails.
  const lastConfirmed = useRef<Map<string, Position>>(new Map())
  const queue = useRef<QueuedMove[]>([])
  const inFlight = useRef<QueuedMove | null>(null)
  const recordsRef = useRef<EditorRecord[] | null>(null)
  recordsRef.current = records
  const draggingRef = useRef(false)
  draggingRef.current = dragging
  const placeModeRef = useRef<string | null>(null)
  placeModeRef.current = placeModeId
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedId
  const undoRef = useRef<UndoEntry[]>([])
  undoRef.current = undoStack
  const lastLoadAt = useRef(0)

  // ── Loading ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoadError(null)
    let res: Response
    try {
      res = await fetch('/api/admin/map', { cache: 'no-store' })
    } catch (err) {
      setLoadError(`Could not reach the server: ${String(err)}`)
      return
    }
    if (!res.ok) {
      const text = await res.text()
      setLoadError(`Load failed (${res.status}): ${text}`)
      return
    }
    const data = (await res.json()) as {
      fetchedAt: string
      records: EditorRecord[]
    }
    const busy = new Set<string>(queue.current.map(m => m.id))
    if (inFlight.current) busy.add(inFlight.current.id)
    setRecords(prev => {
      // Keep the local position of anything still being saved.
      if (!prev) return data.records
      const local = new Map(prev.map(r => [r.id, r]))
      return data.records.map(r =>
        busy.has(r.id) && local.has(r.id)
          ? { ...r, x: local.get(r.id)!.x, y: local.get(r.id)!.y }
          : r
      )
    })
    for (const r of data.records) {
      if (!busy.has(r.id)) lastConfirmed.current.set(r.id, { x: r.x, y: r.y })
    }
    setFetchedAt(data.fetchedAt)
    lastLoadAt.current = Date.now()
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Refresh when coming back to the tab after a while — but never in the
  // middle of a drag, a save, or a placement.
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastLoadAt.current < REFRESH_ON_FOCUS_MS) return
      if (draggingRef.current || inFlight.current || queue.current.length)
        return
      if (placeModeRef.current) return
      void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  // ── Local mutation + save queue ──────────────────────────────────────────

  const setLocalPosition = useCallback((id: string, x: number, y: number) => {
    setRecords(prev =>
      prev ? prev.map(r => (r.id === id ? { ...r, x, y } : r)) : prev
    )
  }, [])

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack(prev => {
      const last = prev[prev.length - 1]
      if (last && last.id === entry.id && entry.at - last.at < UNDO_MERGE_MS) {
        // Merge a burst of nudges into one step, keeping the original origin.
        return [...prev.slice(0, -1), { ...entry, from: last.from }]
      }
      return [...prev.slice(-49), entry]
    })
  }, [])

  const processQueue = useCallback(async () => {
    if (inFlight.current) return
    const next = queue.current.shift()
    if (!next) return
    inFlight.current = next
    const expected = lastConfirmed.current.get(next.id) ?? { x: null, y: null }
    const name =
      recordsRef.current?.find(r => r.id === next.id)?.labelName ?? next.id
    setStatus({
      kind: 'saving',
      text: `Saving ${name} → (${fmt(next.x)}, ${fmt(next.y)})…`,
    })
    try {
      const res = await fetch('/api/admin/map', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: next.id, x: next.x, y: next.y, expected }),
      })
      if (res.status === 409) {
        const data = (await res.json()) as { current: Position }
        lastConfirmed.current.set(next.id, data.current)
        if (data.current.x !== null && data.current.y !== null) {
          setLocalPosition(next.id, data.current.x, data.current.y)
        }
        setStatus({
          kind: 'stale',
          text: `${name} was moved in Airtable since you loaded – shown at its current position (${
            data.current.x === null ? '–' : fmt(data.current.x)
          }, ${data.current.y === null ? '–' : fmt(data.current.y)}). Drag again if you still want to move it.`,
        })
      } else if (!res.ok) {
        let message = `Save failed (${res.status})`
        try {
          const data = (await res.json()) as { error?: string }
          if (data.error) message = `Save failed (${res.status}): ${data.error}`
        } catch {
          // non-JSON error body; keep the status text
        }
        throw new Error(message)
      } else {
        const data = (await res.json()) as {
          record: { id: string; x: number; y: number }
        }
        const stored = data.record
        if (!next.isUndo && expected.x !== null && expected.y !== null) {
          pushUndo({
            id: next.id,
            from: { x: expected.x, y: expected.y },
            to: { x: stored.x, y: stored.y },
            at: Date.now(),
          })
        }
        lastConfirmed.current.set(next.id, { x: stored.x, y: stored.y })
        setLocalPosition(next.id, stored.x, stored.y)
        setStatus({
          kind: 'ok',
          text: `Saved ${name} at (${fmt(stored.x)}, ${fmt(stored.y)}) · ${new Date().toLocaleTimeString()}`,
        })
        setErrorBanner(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const back = lastConfirmed.current.get(next.id)
      if (back && back.x !== null && back.y !== null) {
        setLocalPosition(next.id, back.x, back.y)
      }
      setStatus({ kind: 'error', text: `Not saved: ${name}` })
      setErrorBanner({ text: message, retry: next })
    } finally {
      inFlight.current = null
      if (queue.current.length) void processQueue()
    }
  }, [pushUndo, setLocalPosition])

  const enqueue = useCallback(
    (move: QueuedMove) => {
      // A newer move of the same pin replaces the one still waiting.
      queue.current = queue.current.filter(m => m.id !== move.id)
      queue.current.push(move)
      void processQueue()
    },
    [processQueue]
  )

  const moveRecord = useCallback(
    (id: string, x: number, y: number, isUndo = false) => {
      const c = clampGrid(roundGrid(x), roundGrid(y))
      setLocalPosition(id, c.x, c.y)
      enqueue({ id, x: c.x, y: c.y, isUndo })
    },
    [enqueue, setLocalPosition]
  )

  const undo = useCallback(() => {
    const last = undoRef.current[undoRef.current.length - 1]
    if (!last) return
    setUndoStack(prev => prev.slice(0, -1))
    moveRecord(last.id, last.from.x, last.from.y, true)
  }, [moveRecord])

  // ── Canvas callbacks ─────────────────────────────────────────────────────

  const onDrop = useCallback(
    (id: string, x: number, y: number, clamped: boolean) => {
      moveRecord(id, x, y)
      if (clamped) {
        setStatus({
          kind: 'saving',
          text: 'Dropped past the edge – clamped to the map edge…',
        })
      }
      setSelectedId(id)
      setPanelTab('selected')
    },
    [moveRecord]
  )

  // Clicking a logo on the map opens its details in the side panel.
  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) setPanelTab('selected')
  }, [])

  const onPlaceClick = useCallback(
    (x: number, y: number) => {
      const id = placeModeRef.current
      if (!id) return
      moveRecord(id, x, y)
      setPlaceModeId(null)
      setSelectedId(id)
      setPanelTab('selected')
    },
    [moveRecord]
  )

  // ── Keyboard: Undo, Escape, arrow nudges ─────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        undo()
        return
      }
      if (e.key === 'Escape') {
        if (typing) return
        if (placeModeRef.current) {
          setPlaceModeId(null)
          return
        }
        if (selectedRef.current) {
          setSelectedId(null)
          return
        }
        controlsRef.current.reset()
        return
      }
      const selId = selectedRef.current
      if (typing || !selId) return
      const step = e.shiftKey ? 1 : 0.1
      const rec = recordsRef.current?.find(r => r.id === selId)
      if (!rec || rec.x === null || rec.y === null) return
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      else return
      e.preventDefault()
      moveRecord(rec.id, rec.x + dx, rec.y + dy)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moveRecord, undo])

  // ── Derived ──────────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    if (!records) return []
    return records.filter(r => {
      if (previewPublic) return r.published
      if (!showDrafts && !r.published) return false
      if (!showFurniture && r.isMagic) return false
      return true
    })
  }, [records, showDrafts, showFurniture, previewPublic])

  const counts = useMemo(() => {
    const all = records ?? []
    const placed = all.filter(r => r.x !== null && r.y !== null).length
    return {
      total: all.length,
      placed,
      unplaced: all.length - placed,
      drafts: all.filter(r => !r.published).length,
    }
  }, [records])

  const selected = records?.find(r => r.id === selectedId) ?? null
  const placing = records?.find(r => r.id === placeModeId) ?? null

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={adminStyles.pageHeading}>
        <h1 className={adminStyles.pageTitle}>Map editor</h1>
        <span className={adminStyles.pageMeta}>
          Drag a logo to move it · click to select · saves to Airtable on drop ·{' '}
          /map updates within a few minutes
        </span>
      </div>

      <div className={`${adminStyles.editorToolbar} ${styles.toolbar}`}>
        <span className={adminStyles.editorStatus}>
          {records
            ? `Live from Airtable · loaded ${
                fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : ''
              } · ${counts.total} records · ${counts.placed} placed · ${
                counts.unplaced
              } unplaced · ${counts.drafts} drafts`
            : 'Loading…'}
        </span>
        <button
          type="button"
          className={adminStyles.editorButton}
          onClick={() => void load()}
          disabled={dragging || !!inFlight.current}
        >
          Refresh
        </button>
        <button
          type="button"
          className={adminStyles.editorButton}
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Cmd/Ctrl+Z"
        >
          Undo{undoStack.length ? ` (${undoStack.length})` : ''}
        </button>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showDrafts}
            onChange={e => setShowDrafts(e.target.checked)}
            disabled={previewPublic}
          />
          Show drafts
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showFurniture}
            onChange={e => setShowFurniture(e.target.checked)}
            disabled={previewPublic}
          />
          Show furniture
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={previewPublic}
            onChange={e => setPreviewPublic(e.target.checked)}
          />
          Preview as public
        </label>
        <span
          className={`${adminStyles.editorStatus} ${
            status.kind === 'saving' ? adminStyles.editorStatusSaving : ''
          } ${status.kind === 'error' ? adminStyles.convError : ''} ${
            status.kind === 'stale' ? styles.statusStale : ''
          }`}
        >
          {status.text}
        </span>
      </div>

      {placing && (
        <div className={`${adminStyles.notice} ${styles.placeNotice}`}>
          Click on the map to place <strong>{placing.title}</strong>
          {placing.area ? ` (its region is ${placing.area})` : ''}. Press Esc to
          cancel.
        </div>
      )}

      {errorBanner && (
        <div className={`${adminStyles.notice} ${styles.errorBanner}`}>
          <span>{errorBanner.text}</span>
          <span className={styles.errorActions}>
            {errorBanner.retry && (
              <button
                type="button"
                className={adminStyles.editorButtonPrimary}
                onClick={() => {
                  const m = errorBanner.retry!
                  setErrorBanner(null)
                  moveRecord(m.id, m.x, m.y, m.isUndo)
                }}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              className={adminStyles.editorButton}
              onClick={() => setErrorBanner(null)}
            >
              Dismiss
            </button>
          </span>
        </div>
      )}

      {loadError && (
        <div className={`${adminStyles.notice} ${styles.errorBanner}`}>
          <span>{loadError}</span>
          <button
            type="button"
            className={adminStyles.editorButtonPrimary}
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      )}

      <div className={styles.split}>
        <div className={styles.canvasWrap}>
          {records ? (
            <MapEditorCanvas
              records={visible}
              selectedId={selectedId}
              placeModeId={placeModeId}
              previewPublic={previewPublic}
              onDrop={onDrop}
              onSelect={onSelect}
              onPlaceClick={onPlaceClick}
              onDragStateChange={setDragging}
              controlsRef={controlsRef}
            />
          ) : (
            <div className={`${styles.canvas} ${styles.canvasLoading}`}>
              <p className="paragraph-small color-teal-300">
                {loadError ? 'Could not load the map.' : 'Loading map…'}
              </p>
            </div>
          )}
        </div>
        {!previewPublic && (
          <SidePanel
            records={records ?? []}
            selected={selected}
            placeModeId={placeModeId}
            tab={panelTab}
            onTabChange={setPanelTab}
            onPlace={id => {
              setPlaceModeId(prev => (prev === id ? null : id))
              setSelectedId(id)
            }}
            onSetPosition={(id, x, y) => moveRecord(id, x, y)}
          />
        )}
      </div>

      <p className={`${adminStyles.sectionHint} ${styles.footnote}`}>
        Only x and y are written – publishing, hiding and Scale stay in
        Airtable. Undo is per tab and cleared on reload. Desktop only.
      </p>
    </div>
  )
}
