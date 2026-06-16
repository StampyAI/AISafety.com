'use client'

import { useState } from 'react'
import type {
  CitationRef,
  MessageEvent,
  UIToolCall,
} from '@/lib/assistant/types'
import { stripChipTokens } from '@/lib/assistant/tokens'
import MessageContent from './MessageContent'
import ToolCallPill from './ToolCallPill'
import styles from './Assistant.module.css'

interface Props {
  events: MessageEvent[]
  toolCalls: UIToolCall[]
  citations: CitationRef[]
  onSuggest?: (query: string, type?: string) => void
  onCitationClick?: (c: CitationRef) => void
}

export default function ThinkingBlock({
  events,
  toolCalls,
  citations,
  onSuggest,
  onCitationClick,
}: Props) {
  const [open, setOpen] = useState(false)
  const searchCount = toolCalls.length
  const label =
    searchCount === 0
      ? 'Thought it through'
      : searchCount === 1
        ? 'Searched once'
        : `Searched ${searchCount} times`

  return (
    <div className={styles.thinkBlock}>
      <button
        type="button"
        className={styles.thinkToggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <svg
          className={styles.thinkToggleIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.5" y2="16.5" />
        </svg>
        <span>{label}</span>
        <svg
          className={`${styles.thinkChevron} ${open ? styles.thinkChevronOpen : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.thinkBody}>
          {events.map((ev, i) => {
            if (ev.kind === 'thinking_done') return null
            if (ev.kind === 'text') {
              const stripped = stripChipTokens(ev.text)
              if (!stripped.trim()) return null
              return (
                <MessageContent
                  key={i}
                  text={stripped}
                  citations={citations}
                  onSuggest={onSuggest}
                  onCitationClick={onCitationClick}
                />
              )
            }
            const call = toolCalls.find(tc => tc.id === ev.toolCallId)
            if (!call) return null
            return <ToolCallPill key={i} call={call} />
          })}
        </div>
      )}
    </div>
  )
}
