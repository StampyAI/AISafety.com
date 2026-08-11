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
import Icon from '@/components/Icon'
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
  // "Searched N times" would miscount page reads as searches, so a turn with
  // any read_listing_page call gets a neutral verb instead.
  const hasPageRead = toolCalls.some(tc => tc.name === 'read_listing_page')
  const label =
    searchCount === 0
      ? 'Thought it through'
      : hasPageRead
        ? searchCount === 1
          ? 'Looked it up'
          : `Looked it up (${searchCount} steps)`
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
        <Icon
          src="/images/icons/search.svg"
          size={16}
          className={styles.thinkToggleIcon}
        />
        <span>{label}</span>
        <Icon
          src="/images/icons/chevron-down.svg"
          size={16}
          className={`${styles.thinkChevron} ${open ? styles.thinkChevronOpen : ''}`}
        />
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
