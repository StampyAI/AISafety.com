'use client'

import { useEffect, useRef } from 'react'
import styles from './Assistant.module.css'

const MAX_TEXTAREA_HEIGHT_PX = 120

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
  isStreaming?: boolean
  onStop?: () => void
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  isStreaming,
  onStop,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`
  }, [value])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && !isStreaming && value.trim().length > 0) onSubmit()
    }
  }

  return (
    <div className={styles.composer}>
      <div className={styles.composerField}>
        <textarea
          ref={ref}
          className={styles.composerInput}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? 'Type a message…'}
          rows={1}
          maxLength={2000}
          aria-label="Message"
        />
        {isStreaming ? (
          <button
            type="button"
            className={styles.stopButton}
            onClick={onStop}
            aria-label="Stop"
            title="Stop"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className={styles.sendButton}
            disabled={disabled || value.trim().length === 0}
            onClick={onSubmit}
            aria-label="Send"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
