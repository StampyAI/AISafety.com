'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { QueueItem } from '@/lib/admin/queue'
import styles from './queue.module.css'

// The Queue is a triage tool Bryce sits in for long stretches, so it has its
// own look (see queue.module.css) rather than the admin's teal card stack:
// a list of items on the left, one item in focus on the right, keyboard
// shortcuts, auto-advance after every decision and an undo toast. Nothing
// here changes the site until Accept is clicked; the API refuses anything
// already decided.

const API = '/api/admin/queue'

type Section = 'requests' | 'broom' | 'rules' | 'comb'
const SECTIONS: Section[] = ['requests', 'broom', 'rules', 'comb']
const SECTION_LABEL: Record<Section, string> = {
  requests: 'Requests',
  broom: 'Broom',
  rules: 'Rules',
  comb: 'Comb',
}

type Theme = 'light' | 'dark'
const THEME_KEY = 'aisafety-admin-queue:theme'

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

function orderedFields(fields: Record<string, unknown>): {
  main: [string, unknown][]
  rest: [string, unknown][]
} {
  const entries = Object.entries(fields).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  )
  const pick = (re: RegExp) => entries.filter(([k]) => re.test(k))
  const main = [...pick(NAME_KEYS), ...pick(URL_KEYS), ...pick(DESC_KEYS)]
  const seen = new Set(main.map(([k]) => k))
  return { main, rest: entries.filter(([k]) => !seen.has(k)) }
}

function linkLabel(url: string): string {
  if (url.includes('mail.google.com')) return 'Open email'
  if (url.includes('discord.com')) return 'Open Discord'
  if (url.includes('airtable.com')) return 'Open in Airtable'
  return 'Open source'
}

function isEditable(v: unknown): boolean {
  return typeof v === 'string' || v === null || v === undefined
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
  const [showDone, setShowDone] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'dark' || saved === 'light') setTheme(saved)
    } catch {
      // storage refused: stay on the default
    }
  }, [])

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
    const flat = SECTIONS.flatMap(s => groups[s])
    return { groups, done, flat }
  }, [items])

  const selected = useMemo(() => {
    if (!items) return null
    return items.find(i => i.id === selectedId) ?? null
  }, [items, selectedId])

  // Keep something in focus: the first open item, or the next one after a
  // decision.
  useEffect(() => {
    if (!items) return
    if (selectedId && ordered.flat.some(i => i.id === selectedId)) return
    if (selected && !isOpen(selected) && showDone) return
    setSelectedId(ordered.flat[0]?.id ?? null)
  }, [items, ordered.flat, selectedId, selected, showDone])

  const draft = (id: string): Draft => drafts[id] ?? FRESH
  const setDraft = useCallback((id: string, patch: Partial<Draft>) => {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? FRESH), ...patch } }))
  }, [])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setShowDone(false)
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
              void act(item, 'accept', { edits: d.edits })
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
  }, [selected, drafts, move, act, toast, showHelp, setDraft])

  const waiting = ordered.flat.length
  const doneToday = ordered.done.length
  const total = waiting + doneToday

  return (
    <div className={`${styles.queue} ${theme === 'dark' ? styles.dark : ''}`}>
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
            title="Keyboard shortcuts"
          >
            ?
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
                  <div className={styles.groupHead}>
                    {SECTION_LABEL[section]}
                    <span className={styles.groupCount}>{list.length}</span>
                  </div>
                  {list.length === 0 ? (
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

          <div className={styles.detail}>
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
            <strong>{toast.text}</strong>
            <span className={styles.toastTitle}>{toast.item.title}</span>
          </span>
          <button
            className={styles.toastUndo}
            disabled={draft(toast.item.id).busy}
            onClick={() => void act(toast.item, 'undo')}
          >
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
      <span className={`${styles.dot} ${dotClass(item)}`} aria-hidden />
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>{item.title}</span>
        <span className={styles.rowMeta}>
          {item.source !== 'Comb' && <span>{item.source}</span>}
          {item.page && <span>{item.page}</span>}
          {item.verdict && (
            <span className={verdictClass(item)}>{item.verdict}</span>
          )}
          {item.status === 'Revising' && <span>revising…</span>}
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
  d,
  setD,
  act,
}: {
  item: QueueItem
  d: Draft
  setD: (patch: Partial<Draft>) => void
  act: (action: Action, extra?: Record<string, unknown>) => void
}) {
  const revising = item.status === 'Revising'
  const nothingToApply = item.type === 'Change' && item.changes.length === 0
  const reason = d.chip ?? d.other.trim()
  const editCount = Object.keys(d.edits).length

  return (
    <div className={styles.detailInner}>
      <div className={styles.detailHead}>
        <div className={styles.pills}>
          <span className={`${styles.pill} ${dotClass(item)}`}>
            {item.source}
          </span>
          {item.page && <span className={styles.pillPage}>{item.page}</span>}
          {item.verdict && (
            <span className={`${styles.pill} ${verdictClass(item)}`}>
              Fable: {item.verdict}
            </span>
          )}
          <span className={styles.when}>{ago(item.createdAt)}</span>
        </div>
        <h2 className={styles.title}>{item.title}</h2>
        <div className={styles.links}>
          {item.sourceLink && (
            <a href={item.sourceLink} target="_blank" rel="noreferrer">
              {linkLabel(item.sourceLink)} ↗
            </a>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗
            </a>
          )}
        </div>
      </div>

      {item.sourceExcerpt && (
        <Fold label="What they wrote" open={item.source !== 'Broom'}>
          <blockquote className={styles.quote}>{item.sourceExcerpt}</blockquote>
        </Fold>
      )}

      {item.type === 'Add' && item.fields && (
        <Fields item={item} d={d} setD={setD} />
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
                <span className={styles.to}>
                  {d.editing === c.field ? (
                    <textarea
                      className={styles.input}
                      rows={2}
                      autoFocus
                      defaultValue={d.edits[c.field] ?? show(c.to)}
                      onBlur={e =>
                        setD({
                          editing: null,
                          edits: { ...d.edits, [c.field]: e.target.value },
                        })
                      }
                    />
                  ) : (
                    <>
                      {c.field in d.edits ? d.edits[c.field] : show(c.to)}
                      {c.field in d.edits && (
                        <em className={styles.edited}>edited</em>
                      )}
                      {!revising && (
                        <button
                          className={styles.edit}
                          onClick={() => setD({ editing: c.field })}
                        >
                          edit
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}

      {item.type === 'Rule' && item.diff && (
        <pre className={styles.code}>{item.diff}</pre>
      )}

      {item.reasons.length > 0 && (
        <Fold
          label={`Why ${item.verdict ? item.verdict.toLowerCase() : 'this'}`}
          summary={item.reasons[0]}
          open={item.source !== 'Comb'}
        >
          <ul className={styles.reasons}>
            {item.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Fold>
      )}

      {item.replyDraft && (
        <Fold label="Reply draft">
          <pre className={styles.draft}>{item.replyDraft}</pre>
        </Fold>
      )}

      {(item.error || d.error) && (
        <p className={styles.error}>{d.error ?? item.error}</p>
      )}

      <div className={styles.actions}>
        {revising ? (
          <p className={styles.note}>
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
                onClick={() => act('accept', { edits: d.edits })}
              >
                {d.busy ? 'Applying…' : acceptLabel(item)} <kbd>A</kbd>
              </button>
            )}
            <button
              className={`${styles.button} ${styles.danger}`}
              disabled={d.busy}
              onClick={() => setD({ mode: 'reject' })}
            >
              Reject <kbd>R</kbd>
            </button>
            {item.type !== 'Rule' && (
              <button
                className={styles.ghost}
                disabled={d.busy}
                onClick={() => setD({ mode: 'note' })}
              >
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

function Fold({
  label,
  summary,
  open = false,
  children,
}: {
  label: string
  summary?: string
  open?: boolean
  children: ReactNode
}) {
  return (
    <details className={styles.fold} open={open}>
      <summary>
        <span className={styles.foldLabel}>{label}</span>
        {summary && <span className={styles.foldSummary}>{summary}</span>}
      </summary>
      <div className={styles.foldBody}>{children}</div>
    </details>
  )
}

function Fields({
  item,
  d,
  setD,
}: {
  item: QueueItem
  d: Draft
  setD: (patch: Partial<Draft>) => void
}) {
  const { main, rest } = orderedFields(item.fields ?? {})
  const revising = item.status === 'Revising'
  const row = ([k, v]: [string, unknown]) => {
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
              defaultValue={value}
              onBlur={e =>
                setD({
                  editing: null,
                  edits: { ...d.edits, [k]: e.target.value },
                })
              }
            />
          ) : (
            <>
              {isUrl ? (
                <a href={v as string} target="_blank" rel="noreferrer">
                  {value}
                </a>
              ) : (
                value
              )}
              {edited && <em className={styles.edited}>edited</em>}
              {!revising && isEditable(v) && (
                <button
                  className={styles.edit}
                  onClick={() => setD({ editing: k })}
                >
                  edit
                </button>
              )}
            </>
          )}
        </span>
      </div>
    )
  }
  return (
    <div className={styles.fields}>
      {main.map(row)}
      {rest.length > 0 && (
        <Fold
          label={`${rest.length} more field${rest.length === 1 ? '' : 's'}`}
        >
          <div className={styles.fields}>{rest.map(row)}</div>
        </Fold>
      )}
    </div>
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
      <h2 className={styles.title}>Done today</h2>
      <p className={styles.note}>
        Published listings and field changes reach the site within about three
        minutes.
      </p>
      <div className={styles.doneList}>
        {items.map(item => (
          <div key={item.id} className={styles.doneRow}>
            <span className={`${styles.dot} ${dotClass(item)}`} aria-hidden />
            <span className={styles.doneTitle}>{item.title}</span>
            <span className={styles.doneWhat}>
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
                {busyFor(item.id) ? 'Undoing…' : 'Undo'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
