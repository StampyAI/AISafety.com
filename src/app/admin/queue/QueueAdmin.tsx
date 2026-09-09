'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { QueueItem } from '@/lib/admin/queue'
import adminStyles from '../admin.module.css'
import styles from './queue.module.css'

const API = '/api/admin/queue'

type Section = 'requests' | 'broom' | 'rules' | 'comb'

const SECTION_TITLE: Record<Section, string> = {
  requests: 'Requests from people',
  broom: 'Broom fixes',
  rules: 'Rule updates for the bots',
  comb: 'Comb suggestions',
}

const SECTION_HINT: Record<Section, string> = {
  requests:
    'Emails and Discord messages asking for an addition or a change, with a link back so you can reply.',
  broom:
    'Listings Broom flagged. Fix = the change Fable proposes; Dismiss = Fable thinks the flag is wrong.',
  rules:
    'Rulebook edits written from your reject reasons. Accepting one applies from the next bot run.',
  comb: 'Unpublished suggestions, Fable’s Publish verdicts first.',
}

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

/** Order the proposed record's fields so what matters is on top. */
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

/** What the link back opens, judged by where it points rather than by the
 *  item's source: a form submission arrives as an email, a Comb suggestion
 *  links to its Airtable record. */
function linkLabel(url: string): string {
  if (url.includes('mail.google.com')) return 'Open the email'
  if (url.includes('discord.com')) return 'Open the Discord message'
  if (url.includes('airtable.com')) return 'Open in Airtable'
  return 'Open the source'
}

function isEditable(v: unknown): boolean {
  return typeof v === 'string' || v === null || v === undefined
}

interface CardState {
  /** Null until the person toggles it: the section decides the default. */
  open: boolean | null
  mode: 'idle' | 'reject' | 'note'
  edits: Record<string, string>
  editing: string | null
  chip: string | null
  other: string
  note: string
  busy: boolean
  error: string | null
}

const FRESH: CardState = {
  open: null,
  mode: 'idle',
  edits: {},
  editing: null,
  chip: null,
  other: '',
  note: '',
  busy: false,
  error: null,
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
  if (item.status === 'Rejected') {
    return `Rejected${item.rejectReason ? ` · ${item.rejectReason}` : ''}`
  }
  if (item.status === 'Accepted')
    return 'Accepted · applies from the next bot run'
  if (item.type === 'Add') return 'Published'
  if (item.type === 'Change') {
    const n = item.changes.length
    return `Changed ${n} field${n === 1 ? '' : 's'}`
  }
  return 'Applied'
}

export default function QueueAdmin() {
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cards, setCards] = useState<Record<string, CardState>>({})

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

  const card = useCallback(
    (id: string): CardState => cards[id] ?? FRESH,
    [cards]
  )
  const setCard = useCallback((id: string, patch: Partial<CardState>) => {
    setCards(prev => ({ ...prev, [id]: { ...(prev[id] ?? FRESH), ...patch } }))
  }, [])

  const act = useCallback(
    async (
      item: QueueItem,
      action: 'accept' | 'reject' | 'revise' | 'undo',
      extra: Record<string, unknown> = {}
    ) => {
      setCard(item.id, { busy: true, error: null })
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
        setCard(item.id, { ...FRESH, open: card(item.id).open })
      } catch (e) {
        setCard(item.id, {
          busy: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [card, setCard]
  )

  const grouped = useMemo(() => {
    const open: Record<Section, QueueItem[]> = {
      requests: [],
      broom: [],
      rules: [],
      comb: [],
    }
    const done: QueueItem[] = []
    for (const item of items ?? []) {
      if (isOpen(item)) open[sectionOf(item)].push(item)
      else done.push(item)
    }
    const byNewest = (a: QueueItem, b: QueueItem) =>
      a.createdAt < b.createdAt ? 1 : -1
    open.requests.sort(byNewest)
    open.broom.sort(
      (a, b) =>
        verdictRank(a.verdict) - verdictRank(b.verdict) || byNewest(a, b)
    )
    open.rules.sort(byNewest)
    open.comb.sort(
      (a, b) =>
        verdictRank(a.verdict) - verdictRank(b.verdict) || byNewest(a, b)
    )
    done.sort((a, b) => ((a.decidedAt ?? '') < (b.decidedAt ?? '') ? 1 : -1))
    return { open, done }
  }, [items])

  const waiting = items ? items.filter(isOpen).length : 0

  return (
    <div className={styles.page}>
      <div className={adminStyles.pageHeading}>
        <h1 className={adminStyles.pageTitle}>Queue</h1>
        <p className={adminStyles.pageMeta}>
          {items === null
            ? 'Loading…'
            : waiting === 0
              ? 'Nothing waiting for you.'
              : `${waiting} waiting for you.`}{' '}
          Nothing here changes the site until you click.
        </p>
      </div>

      {loadError && (
        <p className={styles.noticeError}>
          Couldn&rsquo;t load the queue: {loadError}{' '}
          <button className={styles.linkButton} onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}

      {items &&
        (['requests', 'broom', 'rules', 'comb'] as Section[]).map(section => {
          const list = grouped.open[section]
          return (
            <section key={section} className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2
                  className={`${adminStyles.editorBlockTitle} ${styles.sectionTitle}`}
                >
                  {SECTION_TITLE[section]}{' '}
                  <span className={styles.count}>{list.length}</span>
                </h2>
                <p className={adminStyles.sectionHint}>
                  {SECTION_HINT[section]}
                </p>
              </div>
              {list.length === 0 ? (
                <p className={styles.empty}>Nothing waiting.</p>
              ) : (
                <div className={styles.cards}>
                  {list.map(item => (
                    <Card
                      key={item.id}
                      item={item}
                      state={card(item.id)}
                      defaultOpen={section !== 'comb'}
                      setState={patch => setCard(item.id, patch)}
                      act={(action, extra) => act(item, action, extra)}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}

      {items && grouped.done.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2
              className={`${adminStyles.editorBlockTitle} ${styles.sectionTitle}`}
            >
              Done today{' '}
              <span className={styles.count}>{grouped.done.length}</span>
            </h2>
            <p className={adminStyles.sectionHint}>
              Published listings and field changes reach the live site within
              about three minutes. Undo puts an item back in the queue.
            </p>
          </div>
          <div className={styles.doneList}>
            {grouped.done.map(item => {
              const s = card(item.id)
              return (
                <div key={item.id} className={styles.doneRow}>
                  <span className={styles.doneTitle}>
                    <SourceBadge item={item} />
                    {item.title}
                  </span>
                  <span className={styles.doneWhat}>
                    {doneLabel(item)}
                    {item.decidedAt && (
                      <span className={styles.muted}>
                        {' '}
                        · {ago(item.decidedAt)}
                      </span>
                    )}
                  </span>
                  <span className={styles.doneActions}>
                    {s.error && (
                      <span className={styles.noticeError}>{s.error}</span>
                    )}
                    <button
                      className={styles.linkButton}
                      disabled={s.busy}
                      onClick={() => void act(item, 'undo')}
                    >
                      {s.busy ? 'Undoing…' : 'Undo'}
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function SourceBadge({ item }: { item: QueueItem }) {
  const cls =
    item.source === 'Broom'
      ? styles.badgeBroom
      : item.source === 'Comb'
        ? styles.badgeComb
        : item.source === 'Teach' || item.type === 'Rule'
          ? styles.badgeRule
          : styles.badgeRequest
  return <span className={`${styles.badge} ${cls}`}>{item.source}</span>
}

function VerdictBadge({ item }: { item: QueueItem }) {
  if (!item.verdict) return null
  const cls =
    item.verdict === 'Publish' || item.verdict === 'Fix'
      ? styles.verdictYes
      : item.verdict === 'Unsure'
        ? styles.verdictMaybe
        : styles.verdictNo
  return (
    <span className={`${styles.verdict} ${cls}`}>Fable: {item.verdict}</span>
  )
}

function Card({
  item,
  state,
  defaultOpen,
  setState,
  act,
}: {
  item: QueueItem
  state: CardState
  defaultOpen: boolean
  setState: (patch: Partial<CardState>) => void
  act: (
    action: 'accept' | 'reject' | 'revise' | 'undo',
    extra?: Record<string, unknown>
  ) => void
}) {
  const open = state.open ?? defaultOpen
  const toggle = () => setState({ open: !open })
  const revising = item.status === 'Revising'

  const edits = state.edits
  const editedFields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(edits)) editedFields[k] = v

  const reason = state.chip ?? state.other.trim()

  return (
    <article className={`${styles.card} ${open ? styles.cardOpen : ''}`}>
      <header className={styles.cardHeader} onClick={toggle}>
        <span className={styles.cardTitleRow}>
          <SourceBadge item={item} />
          {item.page && <span className={styles.badgePage}>{item.page}</span>}
          <span className={styles.cardTitle}>{item.title}</span>
        </span>
        <span className={styles.cardRight}>
          <VerdictBadge item={item} />
          <span className={styles.muted}>{ago(item.createdAt)}</span>
          <span className={styles.chevron} aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </span>
      </header>

      {open && (
        <div className={styles.cardBody}>
          <div className={styles.links}>
            {item.sourceLink && (
              <a href={item.sourceLink} target="_blank" rel="noreferrer">
                {linkLabel(item.sourceLink)}
              </a>
            )}
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </div>

          {item.sourceExcerpt && (
            <blockquote className={styles.excerpt}>
              {item.sourceExcerpt}
            </blockquote>
          )}

          {item.type === 'Add' && item.fields && (
            <Fields item={item} state={state} setState={setState} />
          )}

          {item.type === 'Change' && (
            <div className={styles.diff}>
              {item.changes.length === 0 ? (
                <p className={styles.muted}>
                  No field change proposed.{' '}
                  {item.verdict === 'Dismiss'
                    ? 'Fable thinks the flag is wrong: Reject clears it.'
                    : 'Reject clears the flag, or ask Claude for a proposal.'}
                </p>
              ) : (
                item.changes.map(c => (
                  <div key={c.field} className={styles.diffRow}>
                    <span className={styles.fieldName}>{c.field}</span>
                    <span className={styles.from}>{show(c.from)}</span>
                    <span className={styles.to}>
                      {state.editing === c.field ? (
                        <textarea
                          className={adminStyles.editorTextarea}
                          rows={2}
                          autoFocus
                          defaultValue={edits[c.field] ?? show(c.to)}
                          onBlur={e =>
                            setState({
                              editing: null,
                              edits: { ...edits, [c.field]: e.target.value },
                            })
                          }
                        />
                      ) : (
                        <>
                          {c.field in edits ? edits[c.field] : show(c.to)}
                          {c.field in edits && (
                            <span className={styles.edited}> (edited)</span>
                          )}
                          {!revising && (
                            <button
                              className={styles.editButton}
                              onClick={() => setState({ editing: c.field })}
                              title="Edit the new value"
                            >
                              edit
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {item.type === 'Rule' && item.diff && (
            <pre className={styles.rule}>{item.diff}</pre>
          )}

          {item.reasons.length > 0 && (
            <details
              className={styles.reasons}
              open={sectionOf(item) !== 'comb'}
            >
              <summary>
                Why Fable says{' '}
                {item.verdict ? item.verdict.toLowerCase() : 'this'}
              </summary>
              <ul>
                {item.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </details>
          )}

          {item.replyDraft && (
            <details className={styles.reasons}>
              <summary>Reply draft</summary>
              <pre className={styles.draft}>{item.replyDraft}</pre>
            </details>
          )}

          {item.error && <p className={styles.noticeError}>{item.error}</p>}
          {state.error && <p className={styles.noticeError}>{state.error}</p>}

          {revising ? (
            <p className={styles.muted}>
              Claude is revising this{item.note ? ` (“${item.note}”)` : ''}. It
              comes back here within a few minutes.
            </p>
          ) : state.mode === 'reject' ? (
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Why? One click, or type it.</p>
              <div className={styles.chips}>
                {item.rejectChips.map(chip => (
                  <button
                    key={chip}
                    className={`${styles.chip} ${state.chip === chip ? styles.chipOn : ''}`}
                    onClick={() =>
                      setState({ chip: state.chip === chip ? null : chip })
                    }
                  >
                    {chip}
                  </button>
                ))}
                <input
                  className={`${adminStyles.editorInput} ${styles.other}`}
                  placeholder="Other…"
                  value={state.other}
                  onChange={e =>
                    setState({ other: e.target.value, chip: null })
                  }
                />
              </div>
              <div className={styles.actions}>
                <button
                  className={`${adminStyles.editorButton} ${styles.rejectButton}`}
                  disabled={state.busy || (!reason && item.type !== 'Rule')}
                  onClick={() => act('reject', { reason })}
                >
                  {state.busy ? 'Rejecting…' : 'Confirm reject'}
                </button>
                <button
                  className={styles.linkButton}
                  disabled={state.busy}
                  onClick={() =>
                    setState({ mode: 'idle', chip: null, other: '' })
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : state.mode === 'note' ? (
            <div className={styles.panel}>
              <p className={styles.panelLabel}>
                Tell Claude what to change. It rewrites the proposal and the
                item comes back here.
              </p>
              <textarea
                className={adminStyles.editorTextarea}
                rows={3}
                autoFocus
                value={state.note}
                placeholder="e.g. Use the org’s full name and shorten the description"
                onChange={e => setState({ note: e.target.value })}
              />
              <div className={styles.actions}>
                <button
                  className={adminStyles.editorButton}
                  disabled={state.busy || !state.note.trim()}
                  onClick={() => act('revise', { note: state.note })}
                >
                  {state.busy ? 'Sending…' : 'Send to Claude'}
                </button>
                <button
                  className={styles.linkButton}
                  disabled={state.busy}
                  onClick={() => setState({ mode: 'idle', note: '' })}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              {/* A Change with nothing to change (Fable said Dismiss or Unsure)
                  has no Apply: Reject clears the flag, or ask for a proposal. */}
              {!(item.type === 'Change' && item.changes.length === 0) && (
                <button
                  className={`${adminStyles.editorButton} ${adminStyles.editorButtonPrimary}`}
                  disabled={state.busy}
                  onClick={() => act('accept', { edits: editedFields })}
                >
                  {state.busy ? 'Applying…' : acceptLabel(item)}
                </button>
              )}
              <button
                className={`${adminStyles.editorButton} ${styles.rejectButton}`}
                disabled={state.busy}
                onClick={() => setState({ mode: 'reject' })}
              >
                Reject
              </button>
              {item.type !== 'Rule' && (
                <button
                  className={styles.linkButton}
                  disabled={state.busy}
                  onClick={() => setState({ mode: 'note' })}
                >
                  Ask Claude to change it
                </button>
              )}
              {Object.keys(edits).length > 0 && (
                <span className={styles.muted}>
                  {Object.keys(edits).length} edited field
                  {Object.keys(edits).length === 1 ? '' : 's'} will be saved
                  with it
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function Fields({
  item,
  state,
  setState,
}: {
  item: QueueItem
  state: CardState
  setState: (patch: Partial<CardState>) => void
}) {
  const { main, rest } = orderedFields(item.fields ?? {})
  const revising = item.status === 'Revising'
  const row = ([k, v]: [string, unknown]) => {
    const edited = k in state.edits
    const value = edited ? state.edits[k] : show(v)
    const isUrl = typeof v === 'string' && /^https?:\/\//.test(v) && !edited
    return (
      <div key={k} className={styles.fieldRow}>
        <dt className={styles.fieldName}>{k}</dt>
        <dd className={styles.fieldValue}>
          {state.editing === k ? (
            <textarea
              className={adminStyles.editorTextarea}
              rows={value.length > 120 ? 5 : 2}
              autoFocus
              defaultValue={value}
              onBlur={e =>
                setState({
                  editing: null,
                  edits: { ...state.edits, [k]: e.target.value },
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
                <span className={styles.fieldText}>{value}</span>
              )}
              {edited && <span className={styles.edited}> (edited)</span>}
              {!revising && isEditable(v) && (
                <button
                  className={styles.editButton}
                  onClick={() => setState({ editing: k })}
                  title="Edit before publishing"
                >
                  edit
                </button>
              )}
            </>
          )}
        </dd>
      </div>
    )
  }
  return (
    <div className={styles.fields}>
      <dl className={styles.fieldList}>{main.map(row)}</dl>
      {rest.length > 0 && (
        <details className={styles.moreFields}>
          <summary>
            {rest.length} more field{rest.length === 1 ? '' : 's'}
          </summary>
          <dl className={styles.fieldList}>{rest.map(row)}</dl>
        </details>
      )}
    </div>
  )
}
