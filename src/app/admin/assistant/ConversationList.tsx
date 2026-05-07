'use client'

import { useEffect, useState } from 'react'
import styles from '../admin.module.css'

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
  geo: { city?: string; region?: string; country?: string } | null
  referrer: string | null
  utm: Record<string, string> | null
  pageState: Record<string, unknown> | null
  zeroMatches: boolean
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
}

function geoString(geo: ConversationData['geo']): string {
  if (!geo) return ''
  return [geo.city, geo.region, geo.country].filter(Boolean).join(', ')
}

export default function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([])
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
      const data = (await res.json()) as { conversations: Conversation[] }
      setConversations(data.conversations)
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
    <div>
      <div className={styles.convFilters}>
        <label>
          <input
            type="checkbox"
            checked={zeroOnly}
            onChange={e => setZeroOnly(e.target.checked)}
          />
          Zero-match only
        </label>
        <button
          type="button"
          className={styles.promptToolbarReset}
          onClick={() => void load(zeroOnly)}
        >
          Refresh
        </button>
        {loading && <span className={styles.convStatus}>loading…</span>}
        {error && (
          <span className={styles.convStatus} style={{ color: '#ff8b8b' }}>
            {error}
          </span>
        )}
      </div>

      <div className={styles.convList}>
        {conversations.map(c => (
          <ConversationRow
            key={c.id}
            conv={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onUpdate={handleUpdate}
          />
        ))}
        {conversations.length === 0 && !loading && (
          <div className={styles.convStatus}>No conversations yet.</div>
        )}
      </div>
    </div>
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
          <span>
            {new Date(conv.createdAt).toLocaleString()} · {conv.page}
            {turnCount > 1 && ` · ${turnCount} turns`}
            {geo && ` · ${geo}`}
            {conv.promptVersion && ` · v${conv.promptVersion}`}
            {data?.zeroMatches && (
              <>
                {' · '}
                <span className={styles.convRowZero}>NO MATCH</span>
              </>
            )}
          </span>
          <span>
            {conv.latencyMs ? `${conv.latencyMs}ms` : ''}
            {conv.tags.length > 0 && ` · ${conv.tags.join(', ')}`}
          </span>
        </div>
        <div className={styles.convRowQuery}>{data?.user ?? ''}</div>
        <div className={styles.convRowResponse}>{data?.response ?? ''}</div>
      </button>

      {expanded && data && (
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
                    <div className={styles.convTurnRole}>{t.role}</div>
                    <div className={styles.convTurnContent}>{t.content}</div>
                  </div>
                ))
              ) : (
                <div className={styles.convDetailValue}>{data.response}</div>
              )}
            </div>
          </div>

          {data.tools.length > 0 && (
            <div className={styles.convDetailField}>
              <div className={styles.convDetailLabel}>Tool calls</div>
              <div className={styles.convDetailValueMono}>
                {JSON.stringify(data.tools, null, 2)}
              </div>
            </div>
          )}

          {data.citations.length > 0 && (
            <div className={styles.convDetailField}>
              <div className={styles.convDetailLabel}>Citations</div>
              <div className={styles.convDetailValue}>
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
              <div className={styles.convDetailLabel}>Referrer</div>
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

          {saveStatus && <div className={styles.convStatus}>{saveStatus}</div>}
        </div>
      )}
    </div>
  )
}
