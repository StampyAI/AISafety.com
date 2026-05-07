'use client'

import { useState } from 'react'
import type { UIToolCall } from '@/lib/assistant/types'
import styles from './Assistant.module.css'

const TOOL_LABELS: Record<string, string> = {
  search_listings: 'Searched',
  get_listing: 'Opened',
}

const TOOL_RUNNING_LABELS: Record<string, string> = {
  search_listings: 'Searching',
  get_listing: 'Fetching',
}

function ToolIcon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'search_listings') {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <line x1="20" y1="20" x2="16.5" y2="16.5" />
      </svg>
    )
  }
  if (name === 'get_listing') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    )
  }
  return null
}

function describeInput(name: string, input: Record<string, unknown>): string {
  if (name === 'search_listings') {
    const query = typeof input.query === 'string' ? input.query : ''
    const type = typeof input.type === 'string' ? input.type : ''
    const filters =
      input.filters && typeof input.filters === 'object'
        ? Object.entries(input.filters as Record<string, unknown>)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')
        : ''
    const parts: string[] = []
    if (query) parts.push(`"${query}"`)
    if (type) parts.push(type)
    if (filters) parts.push(filters)
    return parts.join(' · ')
  }
  if (name === 'get_listing') {
    const id = typeof input.id === 'string' ? input.id : ''
    return id
  }
  return ''
}

function formatInputDetails(
  name: string,
  input: Record<string, unknown>
): string[] {
  const out: string[] = []
  if (name === 'search_listings') {
    if (input.type) out.push(`type: ${String(input.type)}`)
    if (input.query) out.push(`query: "${String(input.query)}"`)
    if (input.filters && typeof input.filters === 'object') {
      for (const [k, v] of Object.entries(
        input.filters as Record<string, unknown>
      )) {
        out.push(`${k}: ${String(v)}`)
      }
    }
    if (input.limit) out.push(`limit: ${String(input.limit)}`)
  } else if (name === 'get_listing') {
    if (input.id) out.push(`id: ${String(input.id)}`)
  } else {
    for (const [k, v] of Object.entries(input)) {
      out.push(`${k}: ${JSON.stringify(v)}`)
    }
  }
  return out
}

export default function ToolCallPill({ call }: { call: UIToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const running = call.status === 'running'
  const label = running
    ? (TOOL_RUNNING_LABELS[call.name] ?? call.name)
    : (TOOL_LABELS[call.name] ?? call.name)
  const detail = describeInput(call.name, call.input)
  const summary = call.resultSummary
  const details = formatInputDetails(call.name, call.input)

  return (
    <div className={styles.toolPillWrap}>
      <button
        type="button"
        className={`${styles.toolPill} ${running ? styles.toolPillRunning : ''}`}
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-label={`${call.name}${detail ? ' ' + detail : ''}${summary ? ', ' + summary : ''}`}
      >
        <span className={styles.toolPillIcon}>
          {running ? (
            <span className={styles.toolPillSpinner} aria-hidden="true" />
          ) : (
            <ToolIcon name={call.name} />
          )}
        </span>
        <span>
          {label}
          {detail && (
            <>
              {' '}
              <span className={styles.toolPillDetail}>· {detail}</span>
            </>
          )}
          {!running && summary && (
            <>
              {' '}
              <span className={styles.toolPillDetail}>· {summary}</span>
            </>
          )}
        </span>
        <svg
          className={`${styles.toolPillChevron} ${expanded ? styles.toolPillChevronOpen : ''}`}
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
      {expanded && (
        <div className={styles.toolPillDetails}>
          <div className={styles.toolPillDetailsLabel}>Input</div>
          <div className={styles.toolPillDetailsCode}>
            {details.length > 0 ? (
              details.map((d, i) => <div key={i}>{d}</div>)
            ) : (
              <span className={styles.toolPillDetailsMuted}>
                (no parameters)
              </span>
            )}
          </div>
          {(call.listings?.length ?? 0) > 0 && (
            <>
              <div className={styles.toolPillDetailsLabel}>Output</div>
              <div className={styles.toolPillDetailsList}>
                {call.listings!.map(l => (
                  <div key={l.id}>
                    <span className={styles.toolPillDetailsName}>{l.name}</span>
                    {l.organization && (
                      <>
                        {' '}
                        <span className={styles.toolPillDetailsMuted}>
                          · {l.organization}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
