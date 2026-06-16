'use client'

import { Fragment, ReactNode, useMemo } from 'react'
import type { CitationRef } from '@/lib/assistant/types'
import { SUGGEST_TYPES } from '@/lib/assistant/constants'
import CitationCard from './CitationCard'
import styles from './Assistant.module.css'

const SUGGEST_TYPE_SET = new Set<string>(SUGGEST_TYPES)

/** `community:are there groups in Amman` → {type:'community', query:'are…'}.
 *  Only treats the leading segment as a type when it's a known listing type, so
 *  a query containing a colon — or an older type-less token — still parses as a
 *  plain query (type undefined → default form). */
function parseSuggestToken(raw: string): { type?: string; query: string } {
  const text = raw.trim()
  const colon = text.indexOf(':')
  if (colon > -1) {
    const head = text.slice(0, colon).trim().toLowerCase()
    if (SUGGEST_TYPE_SET.has(head)) {
      return { type: head, query: text.slice(colon + 1).trim() }
    }
  }
  return { query: text }
}

interface Props {
  text: string
  citations: CitationRef[]
  onSuggest?: (query: string, type?: string) => void
  onCitationClick?: (citation: CitationRef) => void
  isStreaming?: boolean
}

// Token-matching regexes are deliberately tolerant of:
//   - canonical form `[[card:type:recXXX|note]]`
//   - bare rec id (missing prefix): `[[card:recXXX]]`
//   - doubled prefixes (re-prefixing mistake): `[[card:type:type:recXXX]]`
//   - whitespace inside brackets / around colons / around the pipe
//   - capitalization on the keyword itself: `[[Card:...]]`
// resolveCitation handles the actual lookup with suffix matching on the
// underlying rec id when the full id doesn't resolve directly.
const INLINE_REGEX =
  /(\[\[\s*id\s*:\s*(?:[a-z][a-z-]*\s*:\s*)*rec[A-Za-z0-9]+\s*\]\])|(\[\[\s*suggest\s*:[^\]\n]*\]\])|(\[\[\s*chip\s*:[^\]\n]*\]\])|(\[\[\s*card\s*:\s*(?:[a-z][a-z-]*\s*:\s*)*rec[A-Za-z0-9]+(?:\s*\|[^\]\n]*)?\s*\]\])|(\[[^\]\n]+\]\([^)\n]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\baisafety\.info(?:\/[^\s<>),]*)?)/gi

const CARD_LINE =
  /^\s*\[\[\s*card\s*:\s*((?:[a-z][a-z-]*\s*:\s*)*rec[A-Za-z0-9]+)(?:\s*\|([^\]\n]*))?\s*\]\]\s*$/i

// Per-token regexes used to extract pieces from a matched token. Anchored
// so they only match if the whole token is well-formed.
const ID_TOKEN_RE =
  /^\[\[\s*id\s*:\s*((?:[a-z][a-z-]*\s*:\s*)*rec[A-Za-z0-9]+)\s*\]\]$/i
const CARD_TOKEN_RE =
  /^\[\[\s*card\s*:\s*((?:[a-z][a-z-]*\s*:\s*)*rec[A-Za-z0-9]+)(?:\s*\|([^\]\n]*))?\s*\]\]$/i
const SUGGEST_TOKEN_RE = /^\[\[\s*suggest\s*:([^\]\n]*)\]\]$/i
const CHIP_TOKEN_RE = /^\[\[\s*chip\s*:([^\]\n]*)\]\]$/i

/** Normalises a captured listing id (e.g. " advisor : recXXX ") by removing
 *  all internal whitespace. */
function normaliseListingId(rawId: string): string {
  return rawId.replace(/\s+/g, '')
}

/** Look up a citation by its full id (e.g. "community:recXXX") with two
 *  fallbacks for common model slip-ups: bare "recXXX" (missing prefix) and
 *  doubled prefixes like "advisor:advisor:recXXX". Both fall back to a
 *  suffix match on the underlying rec id. */
function resolveCitation(
  rawId: string,
  citationsById: Map<string, CitationRef>
): CitationRef | undefined {
  const direct = citationsById.get(rawId)
  if (direct) return direct
  const recMatch = rawId.match(/rec[A-Za-z0-9]+$/)
  if (recMatch) {
    const rec = recMatch[0]
    for (const cit of citationsById.values()) {
      if (cit.id.endsWith(`:${rec}`)) return cit
    }
  }
  return undefined
}

/** While streaming, hide any in-progress `[[...]]` directive token at the
 *  end of the buffer so users don't see raw `[[card:` / `[[chip:` /
 *  `[[/think...` flicker before the renderer can replace them with UI. */
function maskStreamingTail(text: string): string {
  const lastDouble = text.lastIndexOf('[[')
  if (lastDouble !== -1 && !text.slice(lastDouble).includes(']]')) {
    return text.slice(0, lastDouble)
  }
  if (text.endsWith('[')) return text.slice(0, -1)
  return text
}

// Anything that LOOKS like a directive — we use this to detect tokens that
// failed the strict parsers (e.g. the model fabricated `[[card:community:
// recAlignment Jams|...]]` with a space in the rec id) and silently strip
// them, rather than leaking the raw text to the user.
const MALFORMED_DIRECTIVE_SWEEP =
  /\[\[\s*(?:card|id|chip|suggest)\b[^\]\n]*?\]\]/gi

function stripMalformedDirectives(text: string): string {
  return text.replace(MALFORMED_DIRECTIVE_SWEEP, m => {
    if (
      CARD_TOKEN_RE.test(m) ||
      ID_TOKEN_RE.test(m) ||
      CHIP_TOKEN_RE.test(m) ||
      SUGGEST_TOKEN_RE.test(m)
    ) {
      return m
    }
    return ''
  })
}

interface CardSpec {
  id: string
  note?: string
}

function parseCardLine(line: string): CardSpec | null {
  const m = CARD_LINE.exec(line)
  if (!m) return null
  return { id: normaliseListingId(m[1]), note: m[2]?.trim() || undefined }
}

function renderInline(
  text: string,
  citationsById: Map<string, CitationRef>,
  onSuggest?: (query: string, type?: string) => void,
  onCitationClick?: (c: CitationRef) => void
): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  INLINE_REGEX.lastIndex = 0

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]

    let m: RegExpExecArray | null
    if ((m = ID_TOKEN_RE.exec(token))) {
      const id = normaliseListingId(m[1])
      const cit = resolveCitation(id, citationsById)
      if (cit) {
        const isExt = /^https?:\/\//.test(cit.url)
        parts.push(
          <a
            key={`c-${key++}`}
            href={cit.url}
            target={isExt ? '_blank' : undefined}
            rel={isExt ? 'noopener noreferrer' : undefined}
            className={styles.inlineCitation}
            title={`Open ${cit.name}`}
            aria-label={`Open ${cit.name}`}
            onClick={() => onCitationClick?.(cit)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        )
      }
    } else if ((m = CARD_TOKEN_RE.exec(token))) {
      // Cards inside a paragraph are rendered as just an inline reference.
      // Block-level card lines are handled by the block parser separately.
      const id = normaliseListingId(m[1])
      const cit = resolveCitation(id, citationsById)
      if (cit) {
        const isExt = /^https?:\/\//.test(cit.url)
        parts.push(
          <a
            key={`c-${key++}`}
            href={cit.url}
            target={isExt ? '_blank' : undefined}
            rel={isExt ? 'noopener noreferrer' : undefined}
            className={styles.inlineCitation}
            title={`Open ${cit.name}`}
            aria-label={`Open ${cit.name}`}
            onClick={() => onCitationClick?.(cit)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        )
      }
    } else if (CHIP_TOKEN_RE.test(token)) {
      // Chip tokens are stripped from visible text; rendered separately
    } else if ((m = SUGGEST_TOKEN_RE.exec(token))) {
      const { type, query } = parseSuggestToken(m[1])
      // Jobs come from 80,000 Hours, not curated here — never offer to submit
      // one, even if the bot emits the token against instructions.
      if (type !== 'job') {
        parts.push(
          <SuggestInline
            key={`s-${key++}`}
            query={query}
            type={type}
            onSuggest={onSuggest}
          />
        )
      }
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        const href = linkMatch[2]
        const isExternal = /^https?:\/\//.test(href)
        parts.push(
          <a
            key={`l-${key++}`}
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
          >
            {linkMatch[1]}
          </a>
        )
      } else {
        parts.push(token)
      }
    } else if (token.startsWith('**')) {
      // Recurse so markdown inside bold (e.g. a link, `**[Jobs](/jobs)**`) is
      // processed rather than shown raw. INLINE_REGEX is shared global state,
      // so save/restore its cursor around the recursive call.
      const saved = INLINE_REGEX.lastIndex
      const inner = renderInline(
        token.slice(2, -2),
        citationsById,
        onSuggest,
        onCitationClick
      )
      INLINE_REGEX.lastIndex = saved
      parts.push(<strong key={`b-${key++}`}>{inner}</strong>)
    } else if (token.startsWith('*')) {
      const saved = INLINE_REGEX.lastIndex
      const inner = renderInline(
        token.slice(1, -1),
        citationsById,
        onSuggest,
        onCitationClick
      )
      INLINE_REGEX.lastIndex = saved
      parts.push(<em key={`i-${key++}`}>{inner}</em>)
    } else if (/^aisafety\.info/i.test(token)) {
      // Auto-linkify bare aisafety.info mentions (the bot writes it as plain
      // text). Scoped to this one domain to avoid false positives.
      parts.push(
        <a
          key={`u-${key++}`}
          href={`https://${token}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {token}
        </a>
      )
    }

    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function SuggestInline({
  query,
  type,
  onSuggest,
}: {
  query: string
  type?: string
  onSuggest?: (query: string, type?: string) => void
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onSuggest?.(query, type)
  }
  return (
    <span className={styles.suggest}>
      <a href="#" className={styles.suggestButton} onClick={handleClick}>
        Suggest a listing
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 17L17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </a>
    </span>
  )
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'ul'; lines: string[] }
  | { kind: 'ol'; lines: string[] }
  | { kind: 'cards'; cards: CardSpec[] }

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let current: Block | null = null

  const flush = () => {
    if (current) {
      if (current.kind === 'cards' && current.cards.length === 0) {
        // skip empty
      } else if (
        (current.kind === 'paragraph' ||
          current.kind === 'ul' ||
          current.kind === 'ol') &&
        current.lines.length === 0
      ) {
        // skip empty
      } else {
        blocks.push(current)
      }
    }
    current = null
  }

  let pendingBlank = false
  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line === '') {
      // A blank line between two items of the same list is a loose-list
      // separator (normal Markdown), not a list break — defer the decision
      // until we see the next line. Any other blank line ends the block as
      // before. Without this, blank-separated `1.`/`2.` items each became
      // their own single-item <ol> and every item restarted numbering at 1.
      if (current && (current.kind === 'ul' || current.kind === 'ol')) {
        pendingBlank = true
      } else {
        flush()
      }
      continue
    }

    const cardSpec = parseCardLine(line)
    const ulMatch = /^\s*[-•]\s+(.+)$/.exec(line)
    const olMatch = /^\s*\d+\.\s+(.+)$/.exec(line)

    // Resolve a deferred blank: keep the list open only if it continues with
    // another item of the same kind; otherwise the blank really did end it.
    if (pendingBlank) {
      const continues =
        (!!ulMatch && current?.kind === 'ul') ||
        (!!olMatch && current?.kind === 'ol')
      if (!continues) flush()
      pendingBlank = false
    }

    if (cardSpec) {
      if (!current || current.kind !== 'cards') {
        flush()
        current = { kind: 'cards', cards: [] }
      }
      current.cards.push(cardSpec)
    } else if (ulMatch) {
      if (!current || current.kind !== 'ul') {
        flush()
        current = { kind: 'ul', lines: [] }
      }
      current.lines.push(ulMatch[1])
    } else if (olMatch) {
      if (!current || current.kind !== 'ol') {
        flush()
        current = { kind: 'ol', lines: [] }
      }
      current.lines.push(olMatch[1])
    } else {
      if (!current || current.kind !== 'paragraph') {
        flush()
        current = { kind: 'paragraph', lines: [] }
      }
      current.lines.push(line)
    }
  }
  flush()
  return blocks
}

export default function MessageContent({
  text,
  citations,
  onSuggest,
  onCitationClick,
  isStreaming,
}: Props) {
  const citationsById = useMemo(
    () => new Map(citations.map(c => [c.id, c])),
    [citations]
  )
  const masked = isStreaming ? maskStreamingTail(text) : text
  const visibleText = stripMalformedDirectives(masked)
  const blocks = useMemo(() => parseBlocks(visibleText), [visibleText])

  return (
    <div className={styles.assistantMessage}>
      {blocks.map((block, i) => {
        if (block.kind === 'cards') {
          return (
            <div key={i} className={styles.citationStack}>
              {block.cards.map((spec, j) => {
                const cit = resolveCitation(spec.id, citationsById)
                if (!cit) return null
                return (
                  <CitationCard
                    key={`${spec.id}-${j}`}
                    citation={cit}
                    note={spec.note}
                    onClick={onCitationClick}
                  />
                )
              })}
            </div>
          )
        }
        if (block.kind === 'paragraph') {
          const paragraphText = block.lines.join(' ')
          return (
            <p key={i}>
              {renderInline(
                paragraphText,
                citationsById,
                onSuggest,
                onCitationClick
              )}
              {isStreaming && i === blocks.length - 1 && (
                <span className={styles.cursor} />
              )}
            </p>
          )
        }
        const Tag = block.kind === 'ul' ? 'ul' : 'ol'
        return (
          <Tag key={i}>
            {block.lines.map((item, j) => (
              <li key={j}>
                <Fragment>
                  {renderInline(
                    item,
                    citationsById,
                    onSuggest,
                    onCitationClick
                  )}
                </Fragment>
              </li>
            ))}
          </Tag>
        )
      })}
      {isStreaming && blocks.length === 0 && (
        <p>
          <span className={styles.cursor} />
        </p>
      )}
    </div>
  )
}
