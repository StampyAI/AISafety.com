'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type {
  CitationRef,
  MessageEvent,
  UIToolCall,
} from '@/lib/assistant/types'
import { extractChips, stripChipTokens } from '@/lib/assistant/tokens'
import Composer from './Composer'
import MessageContent from './MessageContent'
import ThinkingBlock from './ThinkingBlock'
import ToolCallPill from './ToolCallPill'
import styles from './Assistant.module.css'

const SCROLL_LOCK_THRESHOLD = 60

const THINKING_DONE_MARKER = '[[/thinking]]'

/** Index of the boundary event, or -1. */
function thinkingDoneIndex(events: MessageEvent[]): number {
  return events.findIndex(e => e.kind === 'thinking_done')
}

/** Append a text delta to the message events. If the delta (concatenated
 *  with any pending in-flight last text) crosses the [[/thinking]] marker,
 *  split: pre-marker text stays in the current text event, push a
 *  `thinking_done` event, then start a new text event with the remainder.
 *  Handles the marker arriving across multiple deltas. */
function appendTextDelta(
  events: MessageEvent[],
  delta: string
): MessageEvent[] {
  // If we've already crossed the boundary, just append into the post-boundary
  // text without re-checking for the marker.
  const boundaryAt = thinkingDoneIndex(events)
  if (boundaryAt !== -1) {
    return appendDeltaToLastText(events, delta)
  }

  // Otherwise, look for the marker in the combined "pending text" — we may
  // have a partial marker straddling multiple deltas, so we check the last
  // text event's content + this delta together.
  const last = events[events.length - 1]
  const lastText = last && last.kind === 'text' ? last.text : ''
  const combined = lastText + delta
  const markerIdx = combined.indexOf(THINKING_DONE_MARKER)

  if (markerIdx === -1) {
    return appendDeltaToLastText(events, delta)
  }

  // Split. Pre-marker portion stays in the current text event.
  const before = combined.slice(0, markerIdx).trimEnd()
  const after = combined
    .slice(markerIdx + THINKING_DONE_MARKER.length)
    .trimStart()

  const next: MessageEvent[] = []
  for (let i = 0; i < events.length; i++) {
    if (i === events.length - 1 && events[i].kind === 'text') {
      // Replace the last text event with the trimmed pre-marker portion
      if (before.length > 0) next.push({ kind: 'text', text: before })
    } else {
      next.push(events[i])
    }
  }
  // If there was no prior text event (unlikely — marker came in first delta),
  // ensure the pre-marker text is captured if non-empty.
  if (
    before.length > 0 &&
    (events.length === 0 || events[events.length - 1].kind !== 'text')
  ) {
    next.push({ kind: 'text', text: before })
  }

  next.push({ kind: 'thinking_done' })

  if (after.length > 0) {
    next.push({ kind: 'text', text: after })
  }

  return next
}

function appendDeltaToLastText(
  events: MessageEvent[],
  delta: string
): MessageEvent[] {
  const next = [...events]
  const last = next[next.length - 1]
  if (last && last.kind === 'text') {
    next[next.length - 1] = { kind: 'text', text: last.text + delta }
  } else {
    next.push({ kind: 'text', text: delta })
  }
  return next
}

export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  events: MessageEvent[]
  toolCalls: UIToolCall[]
  citations: CitationRef[]
  followUpChips: string[]
  isStreaming: boolean
  error?: string
}

export interface ChatBodyHandle {
  clear: () => void
}

interface Props {
  /** API endpoint to POST messages to. */
  endpoint: string
  /** Extra fields merged into the POST body. Function form is called per
   *  send so it can capture dynamic context. */
  bodyExtras?:
    | Record<string, unknown>
    | (() => Record<string, unknown> | Promise<Record<string, unknown>>)
  /** Page chips for the empty state. */
  chips?: string[]
  /** Greeting bubble for the empty state. */
  greeting?: string
  /** sessionStorage key for persisting messages (omit to disable). */
  storageKey?: string
  onSuggest?: (query: string) => void
  onCitationClick?: (c: CitationRef) => void
  /** Fires whenever the message count transitions between 0 and >0, so the
   *  parent can show/hide a clear button without polling. */
  onHasMessagesChange?: (hasMessages: boolean) => void
  /** Whether to react to user-pressed Escape (production wants this; admin
   *  rarely does). */
  closeOnEscape?: boolean
  onCloseEscape?: () => void
  /** When true, snap to bottom whenever the parent layout might have
   *  changed dimensions (e.g. panel expand toggle). */
  resizeKey?: string | number
}

const ChatBody = forwardRef<ChatBodyHandle, Props>(function ChatBody(
  {
    endpoint,
    bodyExtras,
    chips,
    greeting,
    storageKey,
    onSuggest,
    onCitationClick,
    onHasMessagesChange,
    closeOnEscape,
    onCloseEscape,
    resizeKey,
  },
  ref
) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isWaiting, setIsWaiting] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Hydrate from session storage (when key provided)
  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as UIMessage[]
      if (Array.isArray(parsed)) {
        setMessages(
          parsed
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ ...m, isStreaming: false }))
        )
      }
    } catch {
      // ignore
    }
  }, [storageKey])

  // Persist messages
  useEffect(() => {
    if (!storageKey) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {
      // ignore quota
    }
  }, [storageKey, messages])

  // Notify parent only on the 0 ↔ N transition so it can show/hide a clear
  // button. Parent gets exact-time updates without polling our handle.
  const hasAnyMessage = messages.length > 0
  useEffect(() => {
    onHasMessagesChange?.(hasAnyMessage)
  }, [hasAnyMessage, onHasMessagesChange])

  // Escape to close
  useEffect(() => {
    if (!closeOnEscape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseEscape?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeOnEscape, onCloseEscape])

  // Scroll-lock detection
  const checkAtBottom = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsAtBottom(distance < SCROLL_LOCK_THRESHOLD)
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onScroll = () => checkAtBottom()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [checkAtBottom])

  // Auto-scroll if user is at bottom
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distance < SCROLL_LOCK_THRESHOLD) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // Resize key change → snap to bottom
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight
      setIsAtBottom(true)
    }, 250)
    return () => clearTimeout(t)
  }, [resizeKey])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const handleClear = useCallback(() => {
    setMessages([])
    setInput('')
    abortRef.current?.abort()
    abortRef.current = null
    setIsWaiting(false)
  }, [])

  useImperativeHandle(ref, () => ({ clear: handleClear }), [handleClear])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsWaiting(false)
    setMessages(prev =>
      prev.map(m =>
        m.isStreaming
          ? { ...m, isStreaming: false, content: m.content || '(stopped)' }
          : m
      )
    )
  }, [])

  const send = useCallback(
    async (text: string, historyOverride?: UIMessage[]) => {
      const trimmed = text.trim()
      if (!trimmed || isWaiting) return

      const baseHistory: UIMessage[] = historyOverride ?? [
        ...messages,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          content: trimmed,
          events: [{ kind: 'text', text: trimmed }],
          toolCalls: [],
          citations: [],
          followUpChips: [],
          isStreaming: false,
        },
      ]
      const asstId = `a-${Date.now()}`
      const asstMsg: UIMessage = {
        id: asstId,
        role: 'assistant',
        content: '',
        events: [],
        toolCalls: [],
        citations: [],
        followUpChips: [],
        isStreaming: true,
      }
      setMessages([...baseHistory, asstMsg])
      setInput('')
      setIsWaiting(true)
      setIsAtBottom(true)
      requestAnimationFrame(() => {
        const el = bodyRef.current
        if (el) el.scrollTop = el.scrollHeight
      })

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const extras =
          typeof bodyExtras === 'function'
            ? await bodyExtras()
            : (bodyExtras ?? {})
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: baseHistory.map(m => ({
              role: m.role,
              content: m.content,
            })),
            ...extras,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`)
        }
        if (!res.body) throw new Error('no response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let streamingText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const eventLine = rawEvent
              .split('\n')
              .find(l => l.startsWith('event:'))
            const dataLine = rawEvent
              .split('\n')
              .find(l => l.startsWith('data:'))
            if (!eventLine || !dataLine) continue
            const eventType = eventLine.slice(6).trim()
            const data = JSON.parse(dataLine.slice(5).trim())

            if (eventType === 'text') {
              const delta = data.delta as string
              streamingText += delta
              setMessages(prev =>
                prev.map(m => {
                  if (m.id !== asstId) return m
                  const events = appendTextDelta(m.events, delta)
                  return { ...m, content: streamingText, events }
                })
              )
            } else if (eventType === 'tool_call_start') {
              const newCall: UIToolCall = {
                id: data.id,
                name: data.name,
                input: {},
                status: 'running',
              }
              setMessages(prev =>
                prev.map(m =>
                  m.id === asstId
                    ? {
                        ...m,
                        toolCalls: [...m.toolCalls, newCall],
                        events: [
                          ...m.events,
                          { kind: 'tool', toolCallId: data.id },
                        ],
                      }
                    : m
                )
              )
            } else if (eventType === 'tool_call_done') {
              const incoming =
                (data.listings as CitationRef[] | undefined) ?? []
              setMessages(prev =>
                prev.map(m => {
                  if (m.id !== asstId) return m
                  const updatedCalls = m.toolCalls.map(tc =>
                    tc.id === data.id
                      ? {
                          ...tc,
                          status: (data.ok ? 'done' : 'error') as
                            | 'done'
                            | 'error',
                          resultSummary: data.summary,
                          input:
                            (data.input as Record<string, unknown>) ?? tc.input,
                          listings: incoming,
                        }
                      : tc
                  )
                  const allListings: CitationRef[] = []
                  const seen = new Set<string>()
                  for (const tc of updatedCalls) {
                    for (const l of tc.listings ?? []) {
                      if (!seen.has(l.id)) {
                        seen.add(l.id)
                        allListings.push(l)
                      }
                    }
                  }
                  return {
                    ...m,
                    toolCalls: updatedCalls,
                    citations: allListings,
                  }
                })
              )
            } else if (eventType === 'error') {
              setMessages(prev =>
                prev.map(m =>
                  m.id === asstId
                    ? {
                        ...m,
                        error:
                          (data.message as string) ?? 'Something went wrong.',
                        isStreaming: false,
                      }
                    : m
                )
              )
            }
            // 'done' is a no-op here; finalisation happens once below after
            // the read loop exits, so the same fields are set whether the
            // server emits 'done' or just closes the stream.
          }
        }
        const followUp = extractChips(streamingText)
        setMessages(prev =>
          prev.map(m =>
            m.id === asstId
              ? { ...m, isStreaming: false, followUpChips: followUp }
              : m
          )
        )
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setMessages(prev =>
            prev.map(m => (m.id === asstId ? { ...m, isStreaming: false } : m))
          )
        } else {
          setMessages(prev =>
            prev.map(m =>
              m.id === asstId
                ? {
                    ...m,
                    error: err instanceof Error ? err.message : 'Network error',
                    isStreaming: false,
                  }
                : m
            )
          )
        }
      } finally {
        setIsWaiting(false)
        abortRef.current = null
      }
    },
    [bodyExtras, endpoint, isWaiting, messages]
  )

  const handleChipClick = useCallback((chip: string) => void send(chip), [send])

  const handleSubmit = useCallback(() => void send(input), [input, send])

  const handleEdit = useCallback(
    (msgId: string) => {
      const idx = messages.findIndex(m => m.id === msgId)
      if (idx === -1) return
      const target = messages[idx]
      if (target.role !== 'user') return
      setInput(target.content)
      setMessages(messages.slice(0, idx))
    },
    [messages]
  )

  const jumpToBottom = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setIsAtBottom(true)
  }, [])

  return (
    <>
      <div className={styles.body} ref={bodyRef}>
        {messages.length === 0 ? (
          <>
            {greeting && (
              <div className={styles.greetingBubble}>{greeting}</div>
            )}
            {chips && chips.length > 0 && (
              <div className={styles.chipsRow}>
                {chips.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    className={styles.chip}
                    onClick={() => handleChipClick(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          messages.map(m =>
            m.role === 'user' ? (
              <div key={m.id} className={styles.userMessageWrap}>
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => handleEdit(m.id)}
                  aria-label="Edit message"
                  title="Edit"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <div className={styles.userMessage}>{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className={styles.message}>
                {(() => {
                  if (m.events.length === 0 && m.isStreaming) {
                    return (
                      <div className={styles.thinking} aria-label="Thinking">
                        <span className={styles.thinkingDot} />
                        <span className={styles.thinkingDot} />
                        <span className={styles.thinkingDot} />
                      </div>
                    )
                  }

                  const boundary = thinkingDoneIndex(m.events)
                  const hasBoundary = boundary !== -1
                  const hasTools = m.toolCalls.length > 0

                  // Helper to render an event sequence inline
                  const renderInline = (
                    events: MessageEvent[],
                    keyPrefix: string,
                    streamingTail: boolean
                  ) =>
                    events.map((ev, i) => {
                      if (ev.kind === 'thinking_done') return null
                      if (ev.kind === 'text') {
                        const stripped = stripChipTokens(ev.text)
                        if (!stripped.trim()) return null
                        const isLast = i === events.length - 1
                        return (
                          <MessageContent
                            key={`${keyPrefix}-${i}`}
                            text={stripped}
                            citations={m.citations}
                            isStreaming={streamingTail && isLast}
                            onSuggest={onSuggest}
                            onCitationClick={onCitationClick}
                          />
                        )
                      }
                      const call = m.toolCalls.find(
                        tc => tc.id === ev.toolCallId
                      )
                      if (!call) return null
                      return (
                        <ToolCallPill key={`${keyPrefix}-${i}`} call={call} />
                      )
                    })

                  if (hasBoundary) {
                    // Model emitted [[/thinking]] — collapse pre-boundary,
                    // stream/show post-boundary as the final answer. This
                    // happens AS SOON as the boundary appears mid-stream, so
                    // the user sees the transition live.
                    const pre = m.events.slice(0, boundary)
                    const post = m.events.slice(boundary + 1)
                    return (
                      <>
                        {(pre.length > 0 || hasTools) && (
                          <ThinkingBlock
                            events={pre}
                            toolCalls={m.toolCalls}
                            citations={m.citations}
                            onSuggest={onSuggest}
                            onCitationClick={onCitationClick}
                          />
                        )}
                        {post.length > 0
                          ? renderInline(post, 'post', m.isStreaming)
                          : m.isStreaming && (
                              <div
                                className={styles.thinking}
                                aria-label="Writing"
                              >
                                <span className={styles.thinkingDot} />
                                <span className={styles.thinkingDot} />
                                <span className={styles.thinkingDot} />
                              </div>
                            )}
                      </>
                    )
                  }

                  // No boundary yet — render events inline.
                  // While streaming, this shows the live thinking trail.
                  // If streaming has ended without a boundary, the model
                  // skipped the marker; treat the whole thing as the answer.
                  return renderInline(m.events, 'flat', m.isStreaming)
                })()}
                {!m.isStreaming && m.followUpChips.length > 0 && (
                  <div className={styles.followUpRow}>
                    {m.followUpChips.map(chip => (
                      <button
                        key={chip}
                        type="button"
                        className={styles.chip}
                        onClick={() => handleChipClick(chip)}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                {m.error && (
                  <div className={styles.errorMessage}>{m.error}</div>
                )}
              </div>
            )
          )
        )}
      </div>

      <button
        type="button"
        className={`${styles.jumpButton} ${
          !isAtBottom ? styles.jumpButtonVisible : ''
        }`}
        onClick={jumpToBottom}
        aria-label="Jump to bottom"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span>Jump to latest</span>
      </button>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isWaiting && !abortRef.current}
        isStreaming={isWaiting}
        onStop={handleStop}
      />
    </>
  )
})

export default ChatBody
