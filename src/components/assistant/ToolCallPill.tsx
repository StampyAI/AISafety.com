'use client'

import { useState } from 'react'
import type { UIToolCall } from '@/lib/assistant/types'
import Icon from '@/components/Icon'
import styles from './Assistant.module.css'

const TOOL_LABELS: Record<string, string> = {
  search_listings: 'Searched',
  get_listing: 'Opened',
  read_listing_page: 'Read website',
  get_program_history: 'Checked past rounds',
}

const TOOL_RUNNING_LABELS: Record<string, string> = {
  search_listings: 'Searching',
  get_listing: 'Fetching',
  read_listing_page: 'Reading website',
  get_program_history: 'Checking past rounds',
}

function ToolIcon({ name }: { name: string }) {
  if (name === 'search_listings') {
    return <Icon src="/images/icons/search.svg" size={16} />
  }
  if (name === 'get_listing') {
    return <Icon src="/images/icons/document.svg" size={16} />
  }
  if (name === 'read_listing_page') {
    return <Icon src="/images/icons/globe.svg" size={16} />
  }
  if (name === 'get_program_history') {
    // Clock turning back — "past rounds".
    return <Icon src="/images/icons/clock-arrow-back.svg" size={16} />
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
  if (name === 'get_listing' || name === 'read_listing_page') {
    const id = typeof input.id === 'string' ? input.id : ''
    return id
  }
  if (name === 'get_program_history') {
    const query = typeof input.query === 'string' ? input.query : ''
    const id = typeof input.id === 'string' ? input.id : ''
    return query ? `"${query}"` : id
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
  } else if (name === 'get_listing' || name === 'read_listing_page') {
    if (input.id) out.push(`id: ${String(input.id)}`)
  } else if (name === 'get_program_history') {
    if (input.id) out.push(`id: ${String(input.id)}`)
    if (input.query) out.push(`query: "${String(input.query)}"`)
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
        <Icon
          src="/images/icons/chevron-down.svg"
          size={16}
          className={`${styles.toolPillChevron} ${expanded ? styles.toolPillChevronOpen : ''}`}
        />
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
