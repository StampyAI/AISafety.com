'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import styles from '../admin.module.css'
import TranscriptMessage, {
  ClickedCardsContext,
  ListingInfoContext,
  type ListingInfo,
} from './TranscriptMessage'

interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationData {
  user: string
  response: string
  history: HistoryTurn[]
  tools: unknown[]
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

function geoString(geo: ConversationData['geo']): string {
  if (!geo) return ''
  const country = geo.country ? countryLabel(geo.country) : undefined
  return [geo.city ?? geo.region, country].filter(Boolean).join(', ')
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

interface ToolCallEntry {
  name?: string
  input?: unknown
  ok?: boolean
}

/** The Data column stores one tool-call array per turn; flatten across
 *  turns and drop anything that isn't a call object. */
function flattenToolCalls(tools: unknown[]): ToolCallEntry[] {
  const out: ToolCallEntry[] = []
  for (const entry of tools) {
    const calls = Array.isArray(entry) ? entry : [entry]
    for (const call of calls) {
      if (call && typeof call === 'object' && 'name' in call) {
        out.push(call as ToolCallEntry)
      }
    }
  }
  return out
}

/** {type:"job", filters:{skillSet:"X"}} → "type: job · skillSet: X" */
function describeToolInput(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const parts: string[] = []
  const walk = (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value == null || value === '') continue
      if (Array.isArray(value)) {
        parts.push(`${key}: ${value.join(', ')}`)
      } else if (typeof value === 'object') {
        walk(value as Record<string, unknown>)
      } else {
        parts.push(`${key}: ${String(value)}`)
      }
    }
  }
  walk(input as Record<string, unknown>)
  return parts.join(' · ')
}

export default function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [listings, setListings] = useState<Record<string, ListingInfo>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zeroOnly, setZeroOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = async (zo: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '50')
      if (zo) params.set('zeroOnly', '1')
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
      }
      setConversations(data.conversations)
      setListings(data.listings ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(zeroOnly)
  }, [zeroOnly])

  const handleUpdate = (updated: Conversation) => {
    setConversations(prev => prev.map(c => (c.id === updated.id ? updated : c)))
  }

  return (
    <ListingInfoContext.Provider value={listings}>
      <div className={styles.convFilters}>
        <label title="Show only conversations where the chatbot searched the directory and found nothing — useful for spotting gaps in the listings">
          <input
            type="checkbox"
            checked={zeroOnly}
            onChange={e => setZeroOnly(e.target.checked)}
          />
          Only chats with no results
        </label>
        <button
          type="button"
          className={styles.editorButton}
          onClick={() => void load(zeroOnly)}
        >
          Refresh
        </button>
        {loading && <span className={styles.convStatus}>loading…</span>}
        {error && <span className={styles.convError}>{error}</span>}
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
                onToggle={() =>
                  setExpandedId(expandedId === c.id ? null : c.id)
                }
                onUpdate={handleUpdate}
              />
            </Fragment>
          )
        })}
        {conversations.length === 0 && !loading && (
          <div className={styles.convStatus}>No conversations yet.</div>
        )}
      </div>
    </ListingInfoContext.Provider>
  )
}

function ConversationRow({
  conv,
  expanded,
  onToggle,
  onUpdate,
}: {
  conv: Conversation
  expanded: boolean
  onToggle: () => void
  onUpdate: (c: Conversation) => void
}) {
  const [notes, setNotes] = useState(conv.notes)
  const [tags, setTags] = useState<string[]>(conv.tags)
  const [tagInput, setTagInput] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const data = conv.data
  const turnCount = data?.history.filter(t => t.role === 'user').length ?? 0
  const geo = data ? geoString(data.geo) : ''
  const toolCalls = data ? flattenToolCalls(data.tools) : []
  // Collapsed row previews the visitor's OPENING message (how they first
  // arrived), not the most recent turn. Fall back to the latest-turn field
  // for old rows that have no stored history.
  const firstUser =
    data?.history.find(t => t.role === 'user')?.content ?? data?.user ?? ''
  // Cards the visitor clicked, keyed by both full id and bare rec so the
  // transcript can badge them regardless of how the token was written.
  const clickedSet = useMemo(() => {
    const s = new Set<string>()
    for (const id of conv.clickedCitations) {
      s.add(id)
      const rec = /rec[A-Za-z0-9]+/.exec(id)?.[0]
      if (rec) s.add(rec)
    }
    return s
  }, [conv.clickedCitations])

  const persist = async (patch: { notes?: string; tags?: string[] }) => {
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

  const removeTag = (t: string) => {
    const next = tags.filter(x => x !== t)
    setTags(next)
    void persist({ tags: next })
  }

  const addTag = (t: string) => {
    const trimmed = t.trim()
    if (!trimmed || tags.includes(trimmed)) return
    const next = [...tags, trimmed]
    setTags(next)
    setTagInput('')
    void persist({ tags: next })
  }

  return (
    <div>
      <button
        type="button"
        className={styles.convRow}
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
            {data?.zeroMatches && (
              <span className={styles.convRowZero}>NO MATCH</span>
            )}
            {data?.status === 'abandoned' && (
              <span
                className={styles.convRowAbandoned}
                title="The visitor left before (or without) an answer streamed — only their question was logged"
              >
                NO REPLY
              </span>
            )}
            {data?.status === 'error' && (
              <span
                className={styles.convRowError}
                title="Generation failed for this turn — only the visitor's question was logged"
              >
                ERROR
              </span>
            )}
          </span>
          <span className={styles.convRowMeta}>
            {conv.tags.length > 0 && <span>{conv.tags.join(', ')}</span>}
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
                {data.history.length > 0 ? (
                  data.history.map((t, i) => (
                    <div
                      key={i}
                      className={
                        t.role === 'user'
                          ? styles.convTurnUser
                          : styles.convTurnAssistant
                      }
                    >
                      <div className={styles.convTurnRole}>
                        {t.role === 'user' ? 'Visitor' : 'Chatbot'}
                      </div>
                      {t.role === 'user' ? (
                        <div className={styles.convTurnContent}>
                          {t.content}
                        </div>
                      ) : (
                        <TranscriptMessage text={t.content} />
                      )}
                    </div>
                  ))
                ) : (
                  <TranscriptMessage text={data.response} />
                )}
              </div>
            </div>

            {toolCalls.length > 0 && (
              <div className={styles.convDetailField}>
                <div className={styles.convDetailLabel}>
                  Searches the chatbot ran ({toolCalls.length})
                </div>
                <div className={styles.convToolCalls}>
                  {toolCalls.map((call, i) => (
                    <span
                      key={i}
                      className={
                        call.ok === false
                          ? styles.convToolCallFailed
                          : styles.convToolCall
                      }
                    >
                      <span className={styles.convToolCallName}>
                        {call.name ?? 'unknown'}
                      </span>
                      {describeToolInput(call.input)}
                      {call.ok === false && ' — failed'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.citations.length > 0 && (
              <div className={styles.convDetailField}>
                <div className={styles.convDetailLabel}>
                  Listings shown or searched ({data.citations.length})
                </div>
                <div className={styles.convCitations}>
                  {data.citations.join(', ')}
                </div>
              </div>
            )}

            {data.pageState && (
              <div className={styles.convDetailField}>
                <div className={styles.convDetailLabel}>Page state</div>
                <div className={styles.convDetailValueMono}>
                  {JSON.stringify(data.pageState, null, 2)}
                </div>
              </div>
            )}

            {data.referrer && (
              <div className={styles.convDetailField}>
                <div className={styles.convDetailLabel}>Came from</div>
                <div className={styles.convDetailValue}>{data.referrer}</div>
              </div>
            )}

            {data.utm && (
              <div className={styles.convDetailField}>
                <div className={styles.convDetailLabel}>UTM</div>
                <div className={styles.convDetailValueMono}>
                  {JSON.stringify(data.utm, null, 2)}
                </div>
              </div>
            )}

            <div className={styles.convDetailField}>
              <div className={styles.convDetailLabel}>Tags</div>
              <div className={styles.convTagInput}>
                {tags.map(t => (
                  <span key={t} className={styles.convTag}>
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className={styles.convTagAdd}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTag(tagInput)
                    }
                  }}
                  placeholder="Add tag, Enter"
                />
              </div>
            </div>

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
