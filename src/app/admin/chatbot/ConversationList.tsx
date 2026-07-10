'use client'

import { Fragment, useContext, useEffect, useMemo, useState } from 'react'
import styles from '../admin.module.css'
import TranscriptMessage, {
  ClickedCardsContext,
  ListingInfoContext,
  hasSuggestButton,
  resolveListing,
  type ListingInfo,
} from './TranscriptMessage'
import ExcludeBrowserToggle from './ExcludeBrowserToggle'
import { greetingFor } from '@/lib/assistant/pages'

interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

interface LoggedToolCall {
  name: string
  input?: { id?: string }
  ok?: boolean
}

/** The tool calls behind the chatbot message at history index msgIdx.
 *
 *  Data.tools holds one array per LOGGED TURN since the conversation began,
 *  and every turn carries exactly one user message (abandoned/error turns log
 *  the question with no reply). Data.history however is a sliding WINDOW (the
 *  last 14 messages), so long conversations lose their oldest messages while
 *  tools keeps growing — the two can only be aligned from the END: the last
 *  user message in the window belongs to the last tools entry, and so on
 *  backwards. A reply's tools sit at the entry of the user message it answers;
 *  a window that opens mid-turn (leading assistant message) resolves to the
 *  entry before the window's first user turn. */
function turnEntryForMessage(
  history: HistoryTurn[],
  entries: unknown[],
  msgIdx: number
): unknown {
  const totalUsers = history.filter(t => t.role === 'user').length
  const usersUpToHere = history
    .slice(0, msgIdx)
    .filter(t => t.role === 'user').length
  return entries[entries.length - 1 - (totalUsers - usersUpToHere)]
}

function toolCallsForMessage(
  history: HistoryTurn[],
  tools: unknown[],
  msgIdx: number
): LoggedToolCall[] {
  const turn = turnEntryForMessage(history, tools, msgIdx)
  if (!Array.isArray(turn)) return []
  return turn.filter(
    (t): t is LoggedToolCall =>
      !!t &&
      typeof t === 'object' &&
      typeof (t as LoggedToolCall).name === 'string'
  )
}

/** Card ids in the reply at history index msgIdx that degraded to a generic
 *  "Browse X" link (or nothing) in the visitor's chat. Undefined when the turn
 *  predates fallback tracking, so the renderer can fall back to its
 *  resolvability heuristic. The set carries each id plus its bare rec form,
 *  since card tokens are sometimes written without the type prefix. */
function fallbackCardsForMessage(
  history: HistoryTurn[],
  fallbackCards: unknown[] | undefined,
  msgIdx: number
): Set<string> | undefined {
  if (!fallbackCards) return undefined
  const turn = turnEntryForMessage(history, fallbackCards, msgIdx)
  if (!Array.isArray(turn)) return undefined
  const set = new Set<string>()
  for (const id of turn) {
    if (typeof id !== 'string') continue
    const cleaned = id.replace(/\s+/g, '')
    set.add(cleaned)
    const rec = /rec[A-Za-z0-9]+/.exec(cleaned)?.[0]
    if (rec) set.add(rec)
  }
  return set
}

/** Web visits (live page reads) the bot made while composing a reply — shown
 *  in the transcript so it's clear when an answer drew on a listing's page. */
function VisitedPages({ reads }: { reads: LoggedToolCall[] }) {
  const listings = useContext(ListingInfoContext)
  if (reads.length === 0) return null
  return (
    <div className={styles.convTurnVisited}>
      {reads.map((r, i) => {
        const id = r.input?.id ?? ''
        const info = resolveListing(listings, id)
        const name = info?.name ?? id
        const url = info?.url
        return (
          <span key={i}>
            {r.ok ? '🌐 visited ' : '🌐 tried '}
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {name}
              </a>
            ) : (
              name
            )}
            {r.ok ? "'s webpage" : "'s webpage – read failed"}
          </span>
        )
      })}
    </div>
  )
}

interface ConversationData {
  user: string
  response: string
  history: HistoryTurn[]
  tools: unknown[]
  /** Per-turn (aligned with tools): card ids that degraded to a "Browse X"
   *  link in the visitor's chat. Absent on rows from before this was logged. */
  fallbackCards?: unknown[]
  citations: string[]
  citationRefs?: { id: string; name: string; url: string; logo?: string }[]
  geo: { city?: string; region?: string; country?: string } | null
  referrer: string | null
  utm: Record<string, string> | null
  pageState: Record<string, unknown> | null
  zeroMatches: boolean
  status?: 'abandoned' | 'error'
}

interface Conversation {
  id: string
  createdAt: string
  session: string
  page: string
  latencyMs: number | null
  promptVersion: string
  notes: string
  tags: string[]
  data: ConversationData | null
  clickedCitations: string[]
}

/** "United States" for an ISO-3166 alpha-2 code, US English spelling. */
const regionNames = new Intl.DisplayNames(['en-US'], { type: 'region' })

/** ISO-3166 alpha-2 → "United States 🇺🇸". Falls back to the raw value when
 *  it isn't a recognisable two-letter country code. */
function countryLabel(code: string): string {
  const cc = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return code
  const flag = String.fromCodePoint(
    ...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
  const name = regionNames.of(cc)
  return `${name && name !== cc ? name : cc} ${flag}`
}

/** ISO 3166-2 subdivision codes that read as opaque abbreviations when Vercel
 *  has no city for a visitor. Keyed by country so codes stay unambiguous;
 *  anything unmapped shows as-is. */
const REGION_NAMES: Record<string, string> = {
  'GB-ENG': 'England',
  'GB-SCT': 'Scotland',
  'GB-WLS': 'Wales',
  'GB-NIR': 'Northern Ireland',
}

function regionLabel(region: string, country?: string): string {
  const cc = country?.trim().toUpperCase() ?? ''
  return REGION_NAMES[`${cc}-${region.trim().toUpperCase()}`] ?? region
}

function geoString(geo: ConversationData['geo']): string {
  if (!geo) return ''
  const country = geo.country ? countryLabel(geo.country) : undefined
  // Prefer the city; only when there's none do we show the region (expanded to
  // a readable name where we have one, e.g. "ENG" → "England").
  const place =
    geo.city ?? (geo.region ? regionLabel(geo.region, geo.country) : undefined)
  return [place, country].filter(Boolean).join(', ')
}

/** "12 June 2026" — site-wide DATE MONTH YEAR convention. */
function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

// Conversations this browser has already opened, so reviewed chats read as
// dimmed — like seen emails in an inbox. Reviewing is personal to the viewer,
// so the ids live in localStorage rather than Airtable. Most recent last,
// capped so the list can't grow without bound.
const VIEWED_KEY = 'admin-conversations-viewed'
const VIEWED_CAP = 5000

function loadViewedIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(VIEWED_KEY) ?? '[]')
    if (!Array.isArray(parsed)) throw new Error('not an array')
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch (err) {
    console.warn('Resetting unreadable viewed-conversations list:', err)
    return []
  }
}

export default function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [listings, setListings] = useState<Record<string, ListingInfo>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zeroOnly, setZeroOnly] = useState(false)
  // `searchInput` tracks the box; `search` is the debounced value actually sent
  // to the server, so we don't refetch on every keystroke.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Airtable cursor for the next, older batch — null once we've reached the
  // very first conversation. Drives the "Load more" button.
  const [offset, setOffset] = useState<string | null>(null)
  // Label for the viewer's local timezone (e.g. "America/Bogota (GMT-5)").
  // Resolved on the client so it matches the row times, which also render in
  // the browser's local zone. Empty until mounted to avoid an SSR mismatch.
  const [tzLabel, setTzLabel] = useState('')
  // Ids of conversations this browser has opened. Loaded after mount
  // (localStorage is browser-only) to avoid an SSR mismatch.
  const [viewed, setViewed] = useState<Set<string>>(new Set())

  const PAGE_SIZE = 200

  const load = async (zo: boolean, q: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      if (zo) params.set('zeroOnly', '1')
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/conversations?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          (data as { error?: string }).error ?? `HTTP ${res.status}`
        )
      }
      const data = (await res.json()) as {
        conversations: Conversation[]
        listings?: Record<string, ListingInfo>
        offset?: string | null
      }
      setConversations(data.conversations)
      setListings(data.listings ?? {})
      setOffset(data.offset ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!offset || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', offset)
      if (zeroOnly) params.set('zeroOnly', '1')
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/conversations?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          (data as { error?: string }).error ?? `HTTP ${res.status}`
        )
      }
      const data = (await res.json()) as {
        conversations: Conversation[]
        listings?: Record<string, ListingInfo>
        offset?: string | null
      }
      // Append older conversations, guarding against any id we already have
      // (a record arriving at the page boundary between requests).
      setConversations(prev => {
        const seen = new Set(prev.map(c => c.id))
        return [...prev, ...data.conversations.filter(c => !seen.has(c.id))]
      })
      setListings(prev => ({ ...prev, ...(data.listings ?? {}) }))
      setOffset(data.offset ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error')
    } finally {
      setLoadingMore(false)
    }
  }

  // Debounce typing into the committed `search` value (350ms after a pause).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    void load(zeroOnly, search)
  }, [zeroOnly, search])

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const abbr = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value
    setTzLabel([tz, abbr && `(${abbr})`].filter(Boolean).join(' '))
    setViewed(new Set(loadViewedIds()))
  }, [])

  const markViewed = (id: string) => {
    if (viewed.has(id)) return
    // Re-read storage so marks from other admin tabs aren't overwritten.
    const ids = [...loadViewedIds().filter(v => v !== id), id].slice(
      -VIEWED_CAP
    )
    try {
      localStorage.setItem(VIEWED_KEY, JSON.stringify(ids))
    } catch (err) {
      console.warn('Could not save viewed-conversations list:', err)
    }
    setViewed(new Set(ids))
  }

  const handleUpdate = (updated: Conversation) => {
    setConversations(prev => prev.map(c => (c.id === updated.id ? updated : c)))
  }

  return (
    <ListingInfoContext.Provider value={listings}>
      <div className={styles.convFilters}>
        <input
          type="search"
          className={styles.convSearch}
          placeholder="Search conversations…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          title="Searches the whole log — user questions, bot replies, listings shown, page and notes"
        />
        <label title="Show only conversations where the chatbot searched the directory and found nothing — useful for spotting gaps in the listings">
          <input
            type="checkbox"
            checked={zeroOnly}
            onChange={e => setZeroOnly(e.target.checked)}
          />
          Only chats with no results
        </label>
        <ExcludeBrowserToggle />
        {loading && <span className={styles.convStatus}>loading…</span>}
        {error && <span className={styles.convError}>{error}</span>}
        {tzLabel && (
          <span
            className={styles.convTzNote}
            title="Times below are shown in your browser's local timezone"
          >
            times in {tzLabel}
          </span>
        )}
      </div>

      <div className={styles.convList}>
        {conversations.map((c, i) => {
          const day = formatDay(c.createdAt)
          const prevDay =
            i > 0 ? formatDay(conversations[i - 1].createdAt) : null
          return (
            <Fragment key={c.id}>
              {day !== prevDay && (
                <div className={styles.convDayDivider}>{day}</div>
              )}
              <ConversationRow
                conv={c}
                expanded={expandedId === c.id}
                viewed={viewed.has(c.id)}
                onToggle={() => {
                  if (expandedId !== c.id) markViewed(c.id)
                  setExpandedId(expandedId === c.id ? null : c.id)
                }}
                onUpdate={handleUpdate}
              />
            </Fragment>
          )
        })}
        {conversations.length === 0 && !loading && (
          <div className={styles.convStatus}>
            {search || zeroOnly
              ? 'No conversations match.'
              : 'No conversations yet.'}
          </div>
        )}
      </div>

      {offset && !loading && (
        <div className={styles.convLoadMore}>
          <button
            type="button"
            className={styles.editorButton}
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </ListingInfoContext.Provider>
  )
}

function ConversationRow({
  conv,
  expanded,
  viewed,
  onToggle,
  onUpdate,
}: {
  conv: Conversation
  expanded: boolean
  viewed: boolean
  onToggle: () => void
  onUpdate: (c: Conversation) => void
}) {
  const [notes, setNotes] = useState(conv.notes)
  const [saveStatus, setSaveStatus] = useState('')
  const data = conv.data
  const turnCount = data?.history.filter(t => t.role === 'user').length ?? 0
  const geo = data ? geoString(data.geo) : ''
  // Collapsed row previews the visitor's OPENING message (how they first
  // arrived), not the most recent turn. Fall back to the latest-turn field
  // for old rows that have no stored history.
  const firstUser =
    data?.history.find(t => t.role === 'user')?.content ?? data?.user ?? ''
  // Cards and links the visitor clicked. New clicks are stored turn-scoped as
  // `<turnIndex>:<listing id>` / `<turnIndex>:link:<href>` so only the
  // instance the visitor actually opened is badged — a listing or href shown
  // in three replies no longer looks like three clicks. For card entries we
  // seed the set with each entry verbatim plus a `<turn>:<rec>` variant
  // (tokens are sometimes written without the type prefix). Legacy entries
  // have no leading `<turn>:` — for those the renderers fall back to matching
  // every copy, preserving old rows' behaviour.
  const clickedSet = useMemo(() => {
    const s = new Set<string>()
    for (const raw of conv.clickedCitations) {
      s.add(raw)
      const turnScoped = /^(\d+):(.+)$/.exec(raw)
      if (turnScoped) {
        const [, turn, id] = turnScoped
        if (!id.startsWith('link:')) {
          const rec = /rec[A-Za-z0-9]+/.exec(id)?.[0]
          if (rec) s.add(`${turn}:${rec}`)
        }
      } else if (!raw.startsWith('link:')) {
        const rec = /rec[A-Za-z0-9]+/.exec(raw)?.[0]
        if (rec) s.add(rec)
      }
    }
    return s
  }, [conv.clickedCitations])
  // Once the bot offered a "Suggest a listing" button, the "NO MATCH" badge is
  // redundant — the no-match was handled gracefully. Keep the badge only for
  // no-match conversations where no suggest form was offered.
  const showedSuggest = useMemo(() => {
    if (!data) return false
    const replies =
      data.history.length > 0
        ? data.history.filter(t => t.role === 'assistant').map(t => t.content)
        : [data.response]
    return replies.some(hasSuggestButton)
  }, [data])

  const persist = async (patch: { notes?: string }) => {
    setSaveStatus('saving…')
    try {
      const res = await fetch('/api/admin/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conv.id, ...patch }),
      })
      if (!res.ok) {
        setSaveStatus('save failed')
        return
      }
      const updated = (await res.json()) as { conversation: Conversation }
      onUpdate(updated.conversation)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 1500)
    } catch {
      setSaveStatus('save failed')
    }
  }

  return (
    <div>
      <button
        type="button"
        className={
          viewed ? `${styles.convRow} ${styles.convRowViewed}` : styles.convRow
        }
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className={styles.convRowHeader}>
          <span className={styles.convRowMeta}>
            <span className={styles.convRowDate}>
              {formatTime(conv.createdAt)}
            </span>
            <span className={styles.convRowPage}>{conv.page}</span>
            {turnCount > 1 && <span>{turnCount} turns</span>}
            {geo && <span>{geo}</span>}
            {data?.zeroMatches && !showedSuggest && (
              <span className={styles.convRowZero}>NO MATCH</span>
            )}
            {data?.status === 'abandoned' && (
              <span
                className={styles.convRowAbandoned}
                title="The user left before (or without) an answer streamed — only their question was logged"
              >
                NO REPLY
              </span>
            )}
            {data?.status === 'error' && (
              <span
                className={styles.convRowError}
                title="Generation failed for this turn — only the user's question was logged"
              >
                ERROR
              </span>
            )}
          </span>
          <span className={styles.convRowMeta}>
            {conv.promptVersion && (
              <span title="Prompt version">v{conv.promptVersion}</span>
            )}
            {conv.latencyMs ? (
              <span title="Response time of the latest reply">
                {formatLatency(conv.latencyMs)}
              </span>
            ) : null}
          </span>
        </div>
        <div className={styles.convRowQuery}>{firstUser}</div>
      </button>

      {expanded && data && (
        <ClickedCardsContext.Provider value={clickedSet}>
          <div className={styles.convDetail}>
            <div className={styles.convDetailField}>
              <div className={styles.convDetailLabel}>
                Transcript ({turnCount} turn{turnCount === 1 ? '' : 's'})
              </div>
              <div className={styles.convTranscript}>
                <div className={styles.convGreeting}>
                  {greetingFor(conv.page)}
                </div>
                {data.history.length > 0 ? (
                  data.history.map((t, i) => {
                    const reads =
                      t.role === 'assistant'
                        ? toolCallsForMessage(
                            data.history,
                            data.tools ?? [],
                            i
                          ).filter(c => c.name === 'read_listing_page')
                        : []
                    return (
                      <div
                        key={i}
                        className={
                          t.role === 'user'
                            ? styles.convTurnUser
                            : styles.convTurnAssistant
                        }
                      >
                        <div className={styles.convTurnRole}>
                          {t.role === 'user' ? 'User' : 'Chatbot'}
                        </div>
                        <VisitedPages reads={reads} />
                        {t.role === 'user' ? (
                          <div className={styles.convTurnContent}>
                            {t.content}
                          </div>
                        ) : (
                          <TranscriptMessage
                            text={t.content}
                            turnIndex={i}
                            fallbackCardIds={fallbackCardsForMessage(
                              data.history,
                              data.fallbackCards,
                              i
                            )}
                          />
                        )}
                      </div>
                    )
                  })
                ) : (
                  <TranscriptMessage text={data.response} />
                )}
              </div>
            </div>

            {data.referrer && (
              <div className={styles.convDetailField}>
                <div className={styles.convDetailLabel}>Came from</div>
                <div className={styles.convDetailValue}>{data.referrer}</div>
              </div>
            )}

            <div className={styles.convDetailField}>
              <div className={styles.convDetailLabel}>Notes</div>
              <textarea
                className={styles.convNotes}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes !== conv.notes) void persist({ notes })
                }}
                placeholder="Notes for this conversation…"
              />
            </div>

            {saveStatus && (
              <div className={styles.convStatus}>{saveStatus}</div>
            )}
          </div>
        </ClickedCardsContext.Provider>
      )}
    </div>
  )
}
