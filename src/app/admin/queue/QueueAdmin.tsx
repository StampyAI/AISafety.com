'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import type { FieldInfo, QueueItem } from '@/lib/admin/queue'
import Icon from '@/components/Icon'
import SitePreview from './SitePreview'
import styles from './queue.module.css'

// The Queue is a triage tool Bryce sits in for long stretches, so it has its
// own look (see queue.module.css) rather than the admin's teal card stack:
// a list of items on the left, one item in focus on the right, keyboard
// shortcuts, auto-advance after every decision and an undo toast. Nothing
// here changes the site until Accept is clicked; the API refuses anything
// already decided.

const API = '/api/admin/queue'
const UPLOAD_API = '/api/admin/queue/upload'

type Section = 'requests' | 'broom' | 'rules' | 'comb'
const SECTIONS: Section[] = ['requests', 'broom', 'rules', 'comb']
const SECTION_LABEL: Record<Section, string> = {
  requests: 'Requests',
  broom: 'Broom',
  rules: 'Rules',
  comb: 'Comb',
}

// Library icons (public/images/icons), rendered through the site's <Icon>.
const ICON = {
  requests: '/images/icons/speech-bubble.svg',
  mail: '/images/icons/mail.svg',
  discord: '/images/icons/discord.svg',
  form: '/images/icons/clipboard.svg',
  broom: '/images/icons/flag.svg',
  comb: '/images/icons/magnifying-glass.svg',
  rule: '/images/icons/book.svg',
  check: '/images/icons/check.svg',
  x: '/images/icons/x.svg',
  question: '/images/icons/question-mark.svg',
  plus: '/images/icons/plus.svg',
  stars: '/images/icons/stars.svg',
  undo: '/images/icons/reset.svg',
  external: '/images/icons/link-out.svg',
  table: '/images/icons/table.svg',
  arrow: '/images/icons/arrow-right.svg',
  timer: '/images/icons/timer.svg',
  done: '/images/icons/check-in-circle.svg',
  pencil: '/images/icons/pencil-small.svg',
  chevron: '/images/icons/chevron-down.svg',
} as const

const SECTION_ICON: Record<Section, string> = {
  requests: ICON.requests,
  broom: ICON.broom,
  rules: ICON.rule,
  comb: ICON.comb,
}

function sourceIcon(item: QueueItem): string {
  if (item.type === 'Rule' || item.source === 'Teach') return ICON.rule
  switch (item.source) {
    case 'Email':
      return ICON.mail
    case 'Discord':
      return ICON.discord
    case 'Form':
      return ICON.form
    case 'Broom':
      return ICON.broom
    default:
      return ICON.comb
  }
}

function verdictIcon(item: QueueItem): string {
  if (item.verdict === 'Publish' || item.verdict === 'Fix') return ICON.check
  if (item.verdict === 'Unsure') return ICON.question
  return ICON.x
}

function linkIcon(url: string): string {
  if (url.includes('airtable.com')) return ICON.table
  if (url.includes('discord.com')) return ICON.discord
  if (url.includes('mail.google.com')) return ICON.mail
  return ICON.external
}

type Theme = 'light' | 'dark'
const THEME_KEY = 'aisafety-admin-queue:theme'
const COLLAPSED_KEY = 'aisafety-admin-queue:collapsed'

function sectionOf(item: QueueItem): Section {
  if (item.type === 'Rule' || item.source === 'Teach') return 'rules'
  if (item.source === 'Broom') return 'broom'
  if (item.source === 'Comb') return 'comb'
  return 'requests'
}

function verdictRank(v: QueueItem['verdict']): number {
  switch (v) {
    case 'Publish':
    case 'Fix':
      return 0
    case 'Unsure':
    case null:
      return 1
    default:
      return 2
  }
}

function ago(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const m = Math.round(ms / 60000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 36) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map(show).join(', ')
  return JSON.stringify(v)
}

const NAME_KEYS = /\b(name|title)\b|^organi[sz]ation$/i
const URL_KEYS = /^(url|website|link|join link|apply link|application link)$/i
const DESC_KEYS = /description/i

function linkLabel(url: string): string {
  if (url.includes('mail.google.com')) return 'Open email'
  if (url.includes('discord.com')) return 'Open Discord'
  if (url.includes('airtable.com')) return 'Open in Airtable'
  return 'Open source'
}

/** Text, numbers, lists of text and empty fields can be typed into. Lists
 *  are edited as comma-separated text. Attachments and checkboxes cannot. */
function isEditable(v: unknown): boolean {
  return (
    typeof v === 'string' ||
    typeof v === 'number' ||
    v === null ||
    v === undefined ||
    (Array.isArray(v) && v.every(x => typeof x === 'string'))
  )
}

/** Turn what was typed back into the shape Airtable expects for that field:
 *  a list stays a list, a number stays a number, empty clears the field. */
function coerceEdits(
  edits: Record<string, string>,
  original: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, text] of Object.entries(edits)) {
    const was = original[k]
    const t = text.trim()
    if (t === '') out[k] = null
    else if (Array.isArray(was)) {
      out[k] = t
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    } else if (typeof was === 'number' && !Number.isNaN(Number(t))) {
      out[k] = Number(t)
    } else out[k] = text
  }
  return out
}

function isOpen(item: QueueItem): boolean {
  return (
    item.status === 'Pending' ||
    item.status === 'Revising' ||
    item.status === 'Failed'
  )
}

function acceptLabel(item: QueueItem): string {
  if (item.type === 'Add') return 'Publish'
  if (item.type === 'Change') return 'Apply change'
  return 'Apply rule'
}

function doneLabel(item: QueueItem): string {
  if (item.status === 'Rejected') return 'Rejected'
  if (item.status === 'Accepted') return 'Accepted'
  if (item.type === 'Add') return 'Published'
  if (item.type === 'Change') {
    const n = item.changes.length
    return `Changed ${n} field${n === 1 ? '' : 's'}`
  }
  return 'Applied'
}

interface Draft {
  mode: 'idle' | 'reject' | 'note'
  edits: Record<string, string>
  editing: string | null
  chip: string | null
  other: string
  note: string
  busy: boolean
  error: string | null
}

const FRESH: Draft = {
  mode: 'idle',
  edits: {},
  editing: null,
  chip: null,
  other: '',
  note: '',
  busy: false,
  error: null,
}

interface Toast {
  item: QueueItem
  text: string
}

type Action = 'accept' | 'reject' | 'revise' | 'undo'

export default function QueueAdmin() {
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [toast, setToast] = useState<Toast | null>(null)
  // The focused item's record as it is in Airtable now, plus the table's
  // field list, so empty fields (a missing logo) show as empty. By item id.
  const [live, setLive] = useState<
    Record<string, { fields: Record<string, unknown>; schema: FieldInfo[] }>
  >({})
  const [showDone, setShowDone] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [collapsed, setCollapsed] = useState<Record<Section, boolean>>({
    requests: false,
    broom: false,
    rules: false,
    comb: false,
  })
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // The page never scrolls as a whole: the queue fills the viewport below the
  // admin header and the list and the detail pane scroll on their own, so
  // the header, the top bar and the list stay put and nothing slides under
  // the header. The header's height depends on the window width, so it is
  // measured rather than assumed.
  useEffect(() => {
    const fit = () => {
      const el = rootRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      el.style.height = `${Math.max(320, window.innerHeight - top)}px`
    }
    fit()
    window.addEventListener('resize', fit)
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    ro?.observe(document.body)
    return () => {
      window.removeEventListener('resize', fit)
      ro?.disconnect()
    }
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'dark' || saved === 'light') setTheme(saved)
      const folded = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}')
      if (folded && typeof folded === 'object') {
        setCollapsed(prev => {
          const next = { ...prev }
          for (const key of SECTIONS) next[key] = folded[key] === true
          return next
        })
      }
    } catch {
      // storage refused: stay on the defaults
    }
  }, [])

  const toggleGroup = (section: Section) => {
    setCollapsed(prev => {
      const next = { ...prev, [section]: !prev[section] }
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // ignore
    }
  }

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch(API, { cache: 'no-store' })
      const data = (await res.json()) as { items?: QueueItem[]; error?: string }
      if (!res.ok || !data.items) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setItems(data.items)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // One flat, ordered list of open items: requests, Broom, rules, then Comb
  // with Fable's Publish verdicts first. Keyboard navigation walks it.
  const ordered = useMemo(() => {
    const groups: Record<Section, QueueItem[]> = {
      requests: [],
      broom: [],
      rules: [],
      comb: [],
    }
    const done: QueueItem[] = []
    for (const item of items ?? []) {
      if (isOpen(item)) groups[sectionOf(item)].push(item)
      else done.push(item)
    }
    const newest = (a: QueueItem, b: QueueItem) =>
      a.createdAt < b.createdAt ? 1 : -1
    const byVerdict = (a: QueueItem, b: QueueItem) =>
      verdictRank(a.verdict) - verdictRank(b.verdict) || newest(a, b)
    groups.requests.sort(newest)
    groups.broom.sort(byVerdict)
    groups.rules.sort(newest)
    groups.comb.sort(byVerdict)
    done.sort((a, b) => ((a.decidedAt ?? '') < (b.decidedAt ?? '') ? 1 : -1))
    const flat = SECTIONS.filter(s => !collapsed[s]).flatMap(s => groups[s])
    return { groups, done, flat }
  }, [items, collapsed])

  const selected = useMemo(() => {
    if (!items) return null
    return items.find(i => i.id === selectedId) ?? null
  }, [items, selectedId])

  // Keep something in focus: the first open item, or the next one after a
  // decision.
  useEffect(() => {
    if (!items) return
    if (selectedId && ordered.flat.some(i => i.id === selectedId)) return
    if (selected && isOpen(selected)) return
    if (selected && !isOpen(selected) && showDone) return
    setSelectedId(ordered.flat[0]?.id ?? null)
  }, [items, ordered.flat, selectedId, selected, showDone])

  useEffect(() => {
    if (!selected || selected.type !== 'Add') return
    if (!selected.targetTable || !selected.targetRecord) return
    if (live[selected.id]) return
    const id = selected.id
    const target = `${selected.targetTable}/${selected.targetRecord}`
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${API}?target=${encodeURIComponent(target)}`, {
          cache: 'no-store',
        })
        const data = (await res.json()) as {
          fields?: Record<string, unknown>
          schema?: FieldInfo[]
        }
        if (!cancelled && res.ok && data.fields) {
          const fields = data.fields
          const schema = data.schema ?? []
          setLive(prev => ({ ...prev, [id]: { fields, schema } }))
        }
      } catch {
        // the snapshot stays
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected, live])

  const setLiveField = useCallback(
    (id: string, field: string, value: unknown) => {
      setLive(prev => {
        const cur = prev[id]
        if (!cur) return prev
        return {
          ...prev,
          [id]: { ...cur, fields: { ...cur.fields, [field]: value } },
        }
      })
    },
    []
  )

  const draft = (id: string): Draft => drafts[id] ?? FRESH
  const setDraft = useCallback((id: string, patch: Partial<Draft>) => {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? FRESH), ...patch } }))
  }, [])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setShowDone(false)
    if (detailRef.current) detailRef.current.scrollTop = 0
    const row = listRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [])

  const move = useCallback(
    (delta: number) => {
      const flat = ordered.flat
      if (flat.length === 0) return
      const i = flat.findIndex(x => x.id === selectedId)
      const next = flat[Math.min(flat.length - 1, Math.max(0, i + delta))]
      if (next) select(next.id)
    },
    [ordered.flat, selectedId, select]
  )

  const act = useCallback(
    async (
      item: QueueItem,
      action: Action,
      extra: Record<string, unknown> = {}
    ) => {
      setDraft(item.id, { busy: true, error: null })
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, action, ...extra }),
        })
        const data = (await res.json()) as { item?: QueueItem; error?: string }
        if (!res.ok || !data.item) {
          throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        const updated = data.item
        setItems(prev =>
          prev ? prev.map(i => (i.id === updated.id ? updated : i)) : prev
        )
        setDrafts(prev => {
          const next = { ...prev }
          delete next[item.id]
          return next
        })
        if (action === 'accept' || action === 'reject') {
          setToast({
            item: updated,
            text:
              action === 'reject'
                ? `Rejected · ${updated.rejectReason ?? ''}`
                : doneLabel(updated),
          })
          // Auto-advance to the next open item.
          const flat = ordered.flat
          const i = flat.findIndex(x => x.id === item.id)
          const next = flat[i + 1] ?? flat[i - 1]
          if (next) select(next.id)
        } else if (action === 'undo') {
          setToast(null)
          select(updated.id)
        }
      } catch (e) {
        setDraft(item.id, {
          busy: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [ordered.flat, select, setDraft]
  )

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 9000)
    return () => clearTimeout(t)
  }, [toast])

  // Keyboard: J/K or arrows move, A/Enter accept, R reject, N note, U undo,
  // ? help, Esc cancel. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (typing) {
        if (e.key === 'Escape') (t as HTMLElement).blur()
        return
      }
      const item = selected
      const d = item ? draft(item.id) : FRESH
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          move(1)
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          move(-1)
          break
        case 'a':
        case 'Enter':
          if (
            item &&
            isOpen(item) &&
            item.status !== 'Revising' &&
            d.mode === 'idle' &&
            !d.busy
          ) {
            if (!(item.type === 'Change' && item.changes.length === 0)) {
              e.preventDefault()
              void act(item, 'accept', {
                edits: coerceEdits(
                  d.edits,
                  item.type === 'Change'
                    ? Object.fromEntries(item.changes.map(c => [c.field, c.to]))
                    : (live[item.id]?.fields ?? item.fields ?? {})
                ),
              })
            }
          } else if (
            item &&
            d.mode === 'reject' &&
            (d.chip || d.other.trim() || item.type === 'Rule') &&
            !d.busy
          ) {
            e.preventDefault()
            void act(item, 'reject', { reason: d.chip ?? d.other.trim() })
          }
          break
        case 'r':
          if (
            item &&
            isOpen(item) &&
            item.status !== 'Revising' &&
            d.mode !== 'reject'
          ) {
            e.preventDefault()
            setDraft(item.id, { mode: 'reject' })
          }
          break
        case 'n':
          if (
            item &&
            isOpen(item) &&
            item.status !== 'Revising' &&
            item.type !== 'Rule' &&
            d.mode !== 'note'
          ) {
            e.preventDefault()
            setDraft(item.id, { mode: 'note' })
          }
          break
        case '1':
        case '2':
        case '3':
          if (item && d.mode === 'reject') {
            const chip = item.rejectChips[Number(e.key) - 1]
            if (chip) {
              e.preventDefault()
              setDraft(item.id, { chip: d.chip === chip ? null : chip })
            }
          }
          break
        case 'u':
          if (toast && !draft(toast.item.id).busy) {
            e.preventDefault()
            void act(toast.item, 'undo')
          }
          break
        case '?':
          e.preventDefault()
          setShowHelp(v => !v)
          break
        case 'Escape':
          if (showHelp) setShowHelp(false)
          else if (item && d.mode !== 'idle') {
            setDraft(item.id, { mode: 'idle', chip: null, other: '', note: '' })
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, drafts, move, act, toast, showHelp, setDraft, live])

  const waiting = ordered.flat.length
  const doneToday = ordered.done.length
  const total = waiting + doneToday

  return (
    <div
      ref={rootRef}
      className={`${styles.queue} ${theme === 'dark' ? styles.dark : ''}`}
    >
      <div className={styles.top}>
        <div className={styles.topLeft}>
          <h1 className={styles.h1}>Queue</h1>
          <span className={styles.topMeta}>
            {items === null
              ? 'Loading…'
              : waiting === 0
                ? 'Nothing waiting'
                : `${waiting} waiting`}
            {doneToday > 0 && (
              <>
                {' · '}
                <button
                  className={`${styles.linkButton} ${showDone ? styles.linkButtonOn : ''}`}
                  onClick={() => setShowDone(v => !v)}
                >
                  {doneToday} done today
                </button>
              </>
            )}
          </span>
        </div>
        <div className={styles.topRight}>
          <button
            className={styles.ghost}
            onClick={() => setShowHelp(v => !v)}
            title="Keyboard shortcuts (?)"
          >
            <Icon src={ICON.question} />
          </button>
          <button className={styles.ghost} onClick={toggleTheme}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        {total > 0 && (
          <div className={styles.progress} aria-hidden>
            <div
              className={styles.progressBar}
              style={{ width: `${Math.round((doneToday / total) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {loadError && (
        <p className={styles.error}>
          Couldn&rsquo;t load the queue: {loadError}{' '}
          <button className={styles.linkButton} onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}

      {items && (
        <div className={styles.split}>
          <div className={styles.list} ref={listRef}>
            {SECTIONS.map(section => {
              const list = ordered.groups[section]
              if (list.length === 0 && section !== 'requests') return null
              return (
                <div key={section} className={styles.group}>
                  <button
                    className={styles.groupHead}
                    onClick={() => toggleGroup(section)}
                    aria-expanded={!collapsed[section]}
                  >
                    <Icon src={SECTION_ICON[section]} size={12} />
                    {SECTION_LABEL[section]}
                    <span className={styles.groupCount}>{list.length}</span>
                    <span
                      className={`${styles.groupChevron} ${collapsed[section] ? styles.groupChevronClosed : ''}`}
                    >
                      <Icon src={ICON.chevron} size={12} />
                    </span>
                  </button>
                  {collapsed[section] ? null : list.length === 0 ? (
                    <div className={styles.groupEmpty}>Nothing waiting</div>
                  ) : (
                    list.map(item => (
                      <Row
                        key={item.id}
                        item={item}
                        active={item.id === selectedId && !showDone}
                        onClick={() => select(item.id)}
                      />
                    ))
                  )}
                </div>
              )
            })}
          </div>

          <div className={styles.detail} ref={detailRef}>
            {showDone ? (
              <DoneList
                items={ordered.done}
                busyFor={id => draft(id).busy}
                errorFor={id => draft(id).error}
                onUndo={item => void act(item, 'undo')}
              />
            ) : selected ? (
              <Detail
                item={selected}
                live={live[selected.id] ?? null}
                onImage={(field, urls) =>
                  setLiveField(selected.id, field, urls)
                }
                d={draft(selected.id)}
                setD={patch => setDraft(selected.id, patch)}
                act={(action, extra) => void act(selected, action, extra)}
              />
            ) : (
              <div className={styles.emptyDetail}>
                {waiting === 0 ? 'All clear.' : 'Pick an item on the left.'}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="status">
          <span className={styles.toastText}>
            <Icon
              src={toast.item.status === 'Rejected' ? ICON.x : ICON.check}
            />
            <strong>{toast.text}</strong>
            <span className={styles.toastTitle}>{toast.item.title}</span>
          </span>
          <button
            className={styles.toastUndo}
            disabled={draft(toast.item.id).busy}
            onClick={() => void act(toast.item, 'undo')}
          >
            <Icon src={ICON.undo} size={12} className={styles.undoIcon} />
            Undo <kbd>U</kbd>
          </button>
        </div>
      )}

      {showHelp && (
        <div className={styles.help} onClick={() => setShowHelp(false)}>
          <div className={styles.helpCard} onClick={e => e.stopPropagation()}>
            <div className={styles.helpTitle}>Keyboard</div>
            <dl className={styles.helpList}>
              <dt>
                <kbd>J</kbd> <kbd>K</kbd>
              </dt>
              <dd>next / previous item</dd>
              <dt>
                <kbd>A</kbd> or <kbd>Enter</kbd>
              </dt>
              <dd>accept</dd>
              <dt>
                <kbd>R</kbd>
              </dt>
              <dd>
                reject, then <kbd>1</kbd>–<kbd>3</kbd> for a reason,{' '}
                <kbd>Enter</kbd> to confirm
              </dd>
              <dt>
                <kbd>N</kbd>
              </dt>
              <dd>ask Claude to change it</dd>
              <dt>
                <kbd>U</kbd>
              </dt>
              <dd>undo the last decision</dd>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>cancel</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  item,
  active,
  onClick,
}: {
  item: QueueItem
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      data-id={item.id}
      className={`${styles.row} ${active ? styles.rowActive : ''}`}
      onClick={onClick}
    >
      <span className={`${styles.rowIcon} ${dotClass(item)}`}>
        <Icon src={sourceIcon(item)} />
      </span>
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>{item.title}</span>
        <span className={styles.rowMeta}>
          {item.source !== 'Comb' && <span>{item.source}</span>}
          {item.page && <span>{item.page}</span>}
          {item.verdict && (
            <span className={`${styles.withIcon} ${verdictClass(item)}`}>
              <Icon src={verdictIcon(item)} size={12} />
              {item.verdict}
            </span>
          )}
          {item.status === 'Revising' && (
            <span className={styles.withIcon}>
              <Icon src={ICON.timer} size={12} />
              revising
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

function dotClass(item: QueueItem): string {
  if (item.source === 'Email' || item.source === 'Form') return styles.dotEmail
  if (item.source === 'Discord') return styles.dotDiscord
  if (item.source === 'Broom') return styles.dotBroom
  if (item.type === 'Rule') return styles.dotRule
  return styles.dotComb
}

function verdictClass(item: QueueItem): string {
  if (item.verdict === 'Publish' || item.verdict === 'Fix') return styles.yes
  if (item.verdict === 'Unsure') return styles.maybe
  return styles.no
}

function Detail({
  item,
  live,
  onImage,
  d,
  setD,
  act,
}: {
  item: QueueItem
  live: { fields: Record<string, unknown>; schema: FieldInfo[] } | null
  onImage: (field: string, urls: string[]) => void
  d: Draft
  setD: (patch: Partial<Draft>) => void
  act: (action: Action, extra?: Record<string, unknown>) => void
}) {
  const revising = item.status === 'Revising'
  const nothingToApply = item.type === 'Change' && item.changes.length === 0
  const reason = d.chip ?? d.other.trim()
  const editCount = Object.keys(d.edits).length
  const original: Record<string, unknown> =
    item.type === 'Change'
      ? Object.fromEntries(item.changes.map(c => [c.field, c.to]))
      : (live?.fields ?? item.fields ?? {})
  const editsToSave = () => coerceEdits(d.edits, original)

  return (
    <div className={styles.detailInner}>
      <div className={styles.detailHead}>
        <div className={styles.pills}>
          <span className={`${styles.pill} ${dotClass(item)}`}>
            <Icon src={sourceIcon(item)} size={12} />
            {item.source}
          </span>
          {item.page && <span className={styles.pillPage}>{item.page}</span>}
          {item.verdict && (
            <span className={`${styles.pill} ${verdictClass(item)}`}>
              <Icon src={verdictIcon(item)} size={12} />
              Fable: {item.verdict}
            </span>
          )}
          <span className={styles.when}>{ago(item.createdAt)}</span>
        </div>
        <h2 className={styles.title}>{item.title}</h2>
        <div className={styles.links}>
          {item.sourceLink && (
            <a
              href={item.sourceLink}
              target="_blank"
              rel="noreferrer"
              className={styles.withIcon}
            >
              <Icon src={linkIcon(item.sourceLink)} size={12} />
              {linkLabel(item.sourceLink)}
            </a>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className={styles.withIcon}
            >
              <Icon src={ICON.external} size={12} />
              {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
        </div>
      </div>

      {item.sourceExcerpt && (
        <section className={styles.block}>
          <h3 className={styles.h3}>
            {item.source === 'Broom' ? 'What Broom found' : 'What they wrote'}
          </h3>
          <blockquote className={styles.quote}>{item.sourceExcerpt}</blockquote>
        </section>
      )}

      {/* Edits typed on the page, in the field's own shape. */}
      {item.type === 'Add' && (live || item.fields) && (
        <>
          <SitePreview
            itemId={item.id}
            page={item.page}
            edits={editsToSave()}
          />
          <Fields
            item={item}
            fields={live?.fields ?? item.fields ?? {}}
            schema={live?.schema ?? []}
            onImage={onImage}
            d={d}
            setD={setD}
          />
        </>
      )}

      {item.type === 'Change' &&
        (nothingToApply ? (
          <p className={styles.note}>
            {item.verdict === 'Dismiss'
              ? 'Fable thinks this flag is wrong. Reject clears it.'
              : 'No change proposed. Reject clears the flag, or ask Claude.'}
          </p>
        ) : (
          <div className={styles.diff}>
            {item.changes.map(c => (
              <div key={c.field} className={styles.diffRow}>
                <span className={styles.label}>{c.field}</span>
                <span className={styles.from}>{show(c.from)}</span>
                <span className={styles.arrow}>
                  <Icon src={ICON.arrow} size={12} />
                </span>
                <span className={styles.to}>
                  {d.editing === c.field ? (
                    <textarea
                      className={styles.input}
                      rows={2}
                      autoFocus
                      defaultValue={d.edits[c.field] ?? show(c.to)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setD({ editing: null })
                        }
                      }}
                      onBlur={e =>
                        setD({
                          editing: null,
                          edits: { ...d.edits, [c.field]: e.target.value },
                        })
                      }
                    />
                  ) : (
                    <EditableValue
                      text={c.field in d.edits ? d.edits[c.field] : show(c.to)}
                      edited={c.field in d.edits}
                      canEdit={!revising}
                      onEdit={() => setD({ editing: c.field })}
                    />
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}

      {item.type === 'Rule' && (
        <section className={styles.block}>
          <h3 className={styles.h3}>What changes for the bots</h3>
          <p className={styles.summary}>
            {item.summary ?? 'No summary was written for this rule.'}
          </p>
          {item.appliesTo && (
            <p className={styles.note}>Applies to: {item.appliesTo}</p>
          )}
        </section>
      )}

      {item.reasons.length > 0 && (
        <section className={styles.block}>
          <h3 className={styles.h3}>
            Why {item.verdict ? item.verdict.toLowerCase() : 'this'}
          </h3>
          <ul className={styles.reasons}>
            {item.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {item.replyDraft && (
        <section className={styles.block}>
          <h3 className={styles.h3}>Reply draft</h3>
          <pre className={styles.draft}>{item.replyDraft}</pre>
        </section>
      )}

      {(item.error || d.error) && (
        <p className={styles.error}>{d.error ?? item.error}</p>
      )}

      <div className={styles.actions}>
        {revising ? (
          <p className={`${styles.note} ${styles.withIcon}`}>
            <Icon src={ICON.timer} size={12} />
            Claude is revising this{item.note ? ` (“${item.note}”)` : ''}.
          </p>
        ) : d.mode === 'reject' ? (
          <div className={styles.panel}>
            <div className={styles.chips}>
              {item.rejectChips.map((chip, i) => (
                <button
                  key={chip}
                  className={`${styles.chip} ${d.chip === chip ? styles.chipOn : ''}`}
                  onClick={() => setD({ chip: d.chip === chip ? null : chip })}
                >
                  <kbd>{i + 1}</kbd> {chip}
                </button>
              ))}
              <input
                className={`${styles.input} ${styles.other}`}
                placeholder="Other reason…"
                value={d.other}
                onChange={e => setD({ other: e.target.value, chip: null })}
                onKeyDown={e => {
                  if (e.key === 'Enter' && reason) act('reject', { reason })
                }}
              />
            </div>
            <div className={styles.buttons}>
              <button
                className={`${styles.button} ${styles.danger}`}
                disabled={d.busy || (!reason && item.type !== 'Rule')}
                onClick={() => act('reject', { reason })}
              >
                <Icon src={ICON.x} size={12} />
                {d.busy ? 'Rejecting…' : 'Confirm reject'} <kbd>↵</kbd>
              </button>
              <button
                className={styles.ghost}
                disabled={d.busy}
                onClick={() => setD({ mode: 'idle', chip: null, other: '' })}
              >
                Cancel <kbd>Esc</kbd>
              </button>
            </div>
          </div>
        ) : d.mode === 'note' ? (
          <div className={styles.panel}>
            <textarea
              className={styles.input}
              rows={3}
              autoFocus
              value={d.note}
              placeholder="What should change? e.g. use the org’s full name, shorten the description"
              onChange={e => setD({ note: e.target.value })}
            />
            <div className={styles.buttons}>
              <button
                className={styles.button}
                disabled={d.busy || !d.note.trim()}
                onClick={() => act('revise', { note: d.note })}
              >
                <Icon src={ICON.stars} size={12} />
                {d.busy ? 'Sending…' : 'Send to Claude'}
              </button>
              <button
                className={styles.ghost}
                disabled={d.busy}
                onClick={() => setD({ mode: 'idle', note: '' })}
              >
                Cancel <kbd>Esc</kbd>
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.buttons}>
            {!nothingToApply && (
              <button
                className={`${styles.button} ${styles.primary}`}
                disabled={d.busy}
                onClick={() => act('accept', { edits: editsToSave() })}
              >
                <Icon
                  src={item.type === 'Add' ? ICON.plus : ICON.check}
                  size={12}
                />
                {d.busy ? 'Applying…' : acceptLabel(item)} <kbd>A</kbd>
              </button>
            )}
            <button
              className={`${styles.button} ${styles.danger}`}
              disabled={d.busy}
              onClick={() => setD({ mode: 'reject' })}
            >
              <Icon src={ICON.x} size={12} />
              Reject <kbd>R</kbd>
            </button>
            {item.type !== 'Rule' && (
              <button
                className={styles.ghost}
                disabled={d.busy}
                onClick={() => setD({ mode: 'note' })}
              >
                <Icon src={ICON.stars} size={12} />
                Ask Claude to change it <kbd>N</kbd>
              </button>
            )}
            {editCount > 0 && (
              <span className={styles.note}>
                {editCount} edit{editCount === 1 ? '' : 's'} go with it
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const IMAGE_URL =
  /\.(png|jpe?g|webp|gif|svg)(\?|$)|airtableusercontent\.com|blob\.vercel-storage\.com/i

function isImageList(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(x => typeof x === 'string' && IMAGE_URL.test(x))
  )
}

// Fields Airtable fills in itself: shown last, never worth editing.
const HOUSEKEEPING =
  /^(created|date added|last modified|created time|record id|submitter's email)$/i

function Fields({
  item,
  fields,
  schema,
  onImage,
  d,
  setD,
}: {
  item: QueueItem
  fields: Record<string, unknown>
  schema: FieldInfo[]
  onImage: (field: string, urls: string[]) => void
  d: Draft
  setD: (patch: Partial<Draft>) => void
}) {
  // With the table's field list we show every column, empty ones included,
  // in the table's order (name, link and description first); without it,
  // only what the snapshot carries.
  const types = new Map(schema.map(f => [f.name, f.type]))
  const all: Record<string, unknown> = {}
  if (schema.length) {
    for (const f of schema) all[f.name] = fields[f.name] ?? null
    for (const [k, v] of Object.entries(fields)) if (!(k in all)) all[k] = v
  } else {
    Object.assign(all, fields)
  }
  const entries = Object.entries(all)
  const pick = (re: RegExp) => entries.filter(([k]) => re.test(k))
  const main = [...pick(NAME_KEYS), ...pick(URL_KEYS), ...pick(DESC_KEYS)]
  const seen = new Set(main.map(([k]) => k))
  const rest = entries.filter(([k]) => !seen.has(k) && !HOUSEKEEPING.test(k))
  const last = entries.filter(([k]) => !seen.has(k) && HOUSEKEEPING.test(k))
  const revising = item.status === 'Revising'
  const row = ([k, v]: [string, unknown]) => {
    const isAttachment = types.get(k) === 'multipleAttachments'
    const empty =
      v === null ||
      v === undefined ||
      v === '' ||
      (Array.isArray(v) && v.length === 0)
    const edited = k in d.edits
    const value = edited ? d.edits[k] : show(v)
    const isUrl = typeof v === 'string' && /^https?:\/\//.test(v) && !edited
    return (
      <div key={k} className={styles.fieldRow}>
        <span className={styles.label}>{k}</span>
        <span className={styles.value}>
          {d.editing === k ? (
            <textarea
              className={styles.input}
              rows={value.length > 120 ? 5 : 2}
              autoFocus
              defaultValue={empty && !edited ? '' : value}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setD({ editing: null })
                }
              }}
              onBlur={e =>
                setD({
                  editing: null,
                  edits: { ...d.edits, [k]: e.target.value },
                })
              }
            />
          ) : isAttachment || isImageList(v) ? (
            <ImageSlot
              itemId={item.id}
              field={k}
              urls={isImageList(v) ? v : []}
              canUpload={isAttachment && !revising}
              onDone={urls => onImage(k, urls)}
            />
          ) : empty ? (
            <EditableValue
              text="—"
              muted
              edited={false}
              canEdit={!revising}
              onEdit={() => setD({ editing: k })}
            />
          ) : (
            <EditableValue
              text={value}
              href={isUrl ? (v as string) : undefined}
              edited={edited}
              canEdit={!revising && isEditable(v) && !isAttachment}
              onEdit={() => setD({ editing: k })}
            />
          )}
        </span>
      </div>
    )
  }
  return (
    <div className={styles.fields}>
      {main.map(row)}
      {rest.length > 0 && (
        <div className={styles.fieldsRest}>{rest.map(row)}</div>
      )}
      {last.length > 0 && (
        <div className={styles.fieldsRest}>{last.map(row)}</div>
      )}
    </div>
  )
}

/** The pictures in an attachment field, and a drop target: drag an image in
 *  or click to choose one, and it goes onto the record right away. */
function ImageSlot({
  itemId,
  field,
  urls,
  canUpload,
  onDone,
}: {
  itemId: string
  field: string
  urls: string[]
  canUpload: boolean
  onDone: (urls: string[]) => void
}) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const send = async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('That is not an image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Over 5 MB.')
      return
    }
    setBusy(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => {
          const s = String(r.result)
          resolve(s.slice(s.indexOf(',') + 1))
        }
        r.onerror = () => reject(new Error('Could not read the file.'))
        r.readAsDataURL(file)
      })
      const res = await fetch(UPLOAD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          field,
          filename: file.name,
          contentType: file.type,
          data: base64,
        }),
      })
      const data = (await res.json()) as { urls?: string[]; error?: string }
      if (!res.ok || !data.urls)
        throw new Error(data.error ?? `HTTP ${res.status}`)
      onDone(data.urls)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // The whole slot — picture included — takes a drop; the new picture
  // replaces the old one. The box is also a button for the file picker.
  const dragProps = canUpload
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault()
          setOver(true)
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          setOver(false)
          const file = e.dataTransfer.files[0]
          if (file) void send(file)
        },
      }
    : {}

  return (
    <span
      className={`${styles.imageSlot} ${over ? styles.imageSlotOver : ''}`}
      title={
        canUpload ? 'Drop an image anywhere here to replace it' : undefined
      }
      {...dragProps}
    >
      {urls.map(src => (
        <span key={src} className={styles.thumbWrap}>
          <Image
            src={src}
            alt=""
            width={56}
            height={56}
            unoptimized
            className={styles.thumb}
          />
          {over && <span className={styles.thumbOverlay}>Replace</span>}
        </span>
      ))}
      {canUpload && (
        <span
          className={`${styles.dropZone} ${over ? styles.dropZoneOver : ''} ${
            urls.length ? styles.dropZoneSmall : ''
          }`}
          role="button"
          tabIndex={0}
          title="Drop an image here, or click to choose one"
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter') inputRef.current?.click()
          }}
        >
          {busy ? 'Uploading…' : urls.length ? 'Replace' : 'Drop image'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) void send(file)
              e.target.value = ''
            }}
          />
        </span>
      )}
      {!canUpload && urls.length === 0 && (
        <span className={styles.noImage}>none</span>
      )}
      {error && <span className={styles.noticeInline}>{error}</span>}
    </span>
  )
}

/** A value you can click to edit: a visible pencil, a hover tint, and a link
 *  that still opens when it is one. */
function EditableValue({
  text,
  href,
  edited,
  canEdit,
  muted,
  onEdit,
}: {
  text: string
  href?: string
  edited: boolean
  canEdit: boolean
  muted?: boolean
  onEdit: () => void
}) {
  const body = href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {text}
    </a>
  ) : (
    <span className={muted ? styles.empty : undefined}>{text}</span>
  )
  if (!canEdit) return body
  return (
    <span
      className={styles.editable}
      role="button"
      tabIndex={0}
      title="Click to edit"
      onClick={e => {
        // A click on the link itself opens the link; anywhere else edits.
        if ((e.target as HTMLElement).tagName === 'A') return
        onEdit()
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onEdit()
        }
      }}
    >
      {body}
      {edited && <em className={styles.edited}>edited</em>}
      <span className={styles.editHint}>
        <Icon src={ICON.pencil} size={12} />
      </span>
    </span>
  )
}

function DoneList({
  items,
  busyFor,
  errorFor,
  onUndo,
}: {
  items: QueueItem[]
  busyFor: (id: string) => boolean
  errorFor: (id: string) => string | null
  onUndo: (item: QueueItem) => void
}) {
  return (
    <div className={styles.detailInner}>
      <h2 className={`${styles.title} ${styles.withIcon}`}>
        <span className={styles.yes}>
          <Icon src={ICON.done} />
        </span>
        Done today
      </h2>
      <p className={styles.note}>
        Published listings and field changes reach the site within about three
        minutes.
      </p>
      <div className={styles.doneList}>
        {items.map(item => (
          <div key={item.id} className={styles.doneRow}>
            <span className={dotClass(item)}>
              <Icon src={sourceIcon(item)} />
            </span>
            <span className={styles.doneTitle}>{item.title}</span>
            <span className={`${styles.doneWhat} ${styles.withIcon}`}>
              <span
                className={item.status === 'Rejected' ? styles.no : styles.yes}
              >
                <Icon
                  src={item.status === 'Rejected' ? ICON.x : ICON.check}
                  size={12}
                />
              </span>
              {doneLabel(item)}
              {item.rejectReason && ` · ${item.rejectReason}`}
              <span className={styles.when}> · {ago(item.decidedAt)}</span>
            </span>
            <span className={styles.doneActions}>
              {errorFor(item.id) && (
                <span className={styles.error}>{errorFor(item.id)}</span>
              )}
              <button
                className={styles.ghost}
                disabled={busyFor(item.id)}
                onClick={() => onUndo(item)}
              >
                <Icon src={ICON.undo} size={12} />
                {busyFor(item.id) ? 'Undoing…' : 'Undo'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
