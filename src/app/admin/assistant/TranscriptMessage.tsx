// Renders a stored assistant reply the way visitors saw it: markdown
// formatted, [[card:...]] lines as listing pills, [[chip:...]] tokens as
// suggestion chips, and the pre-[[/thinking]] search trail dimmed. The
// stored history has no resolvable citation objects, so card pills are
// label-driven (the text after the | in the token).

import { createContext, Fragment, ReactNode, useContext } from 'react'
import styles from '../admin.module.css'

/** id → listing name, supplied by the conversations API so card pills can
 *  show which listing they are (the stored token only has the id + note). */
export const ListingNamesContext = createContext<Record<string, string>>({})

/** Resolve a card token's id to its listing name: try the full id, then the
 *  bare rec id (handles tokens written without a type prefix). */
function resolveListingName(
  names: Record<string, string>,
  id: string
): string | null {
  const cleaned = id.replace(/\s+/g, '')
  if (names[cleaned]) return names[cleaned]
  const rec = /rec[A-Za-z0-9]+/.exec(cleaned)?.[0]
  if (rec && names[rec]) return names[rec]
  return null
}

const THINKING_RE = /\[\[\s*\/?\s*thinking\s*\]\]/i
const CHIP_RE = /\[\[\s*chip\s*:([^\]\n]*)\]\]/gi
const SUGGEST_RE = /\[\[\s*suggest\s*:[^\]\n]*\]\]/gi
const CARD_LINE_RE =
  /^\s*\[\[\s*card\s*:\s*([^\]|\n]+?)(?:\s*\|([^\]\n]*))?\s*\]\]\s*$/i
const INLINE_RE =
  /(\[\[[^\]\n]*\]\])|(\[[^\]\n]+\]\(\/?[^)\n]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g
const ANY_DIRECTIVE_RE = /\[\[[^\]]*\]\]/g

/** "job:recXXX" → "job"; bare rec ids have no type. */
function cardType(rawId: string): string | null {
  const cleaned = rawId.replace(/\s+/g, '')
  const m = /^([a-z-]+):/i.exec(cleaned)
  return m ? m[1].toLowerCase() : null
}

/** Human label for an inline card/id token: prefer the resolved listing
 *  name, then the |label, then the type prefix, then the bare rec id. */
function inlineCardLabel(token: string, names: Record<string, string>): string {
  const m =
    /^\[\[\s*(?:card|id)\s*:\s*([^\]|\n]+?)(?:\s*\|([^\]\n]*))?\s*\]\]$/i.exec(
      token
    )
  if (!m) return ''
  const name = resolveListingName(names, m[1])
  if (name) return name
  if (m[2]?.trim()) return m[2].trim()
  const type = cardType(m[1])
  const rec = /rec[A-Za-z0-9]+/.exec(m[1])?.[0] ?? m[1].trim()
  return type ? `${type} ${rec}` : rec
}

interface ParsedMessage {
  thinking: string | null
  body: string
  chips: string[]
  suggestedListing: boolean
}

function parseMessage(text: string): ParsedMessage {
  const thinkingMatch = THINKING_RE.exec(text)
  const thinking = thinkingMatch
    ? text.slice(0, thinkingMatch.index).trim() || null
    : null
  let body = thinkingMatch
    ? text.slice(thinkingMatch.index + thinkingMatch[0].length)
    : text

  const chips: string[] = []
  body = body.replace(CHIP_RE, (_, label: string) => {
    const trimmed = label.trim()
    if (trimmed) chips.push(trimmed)
    return ''
  })

  const suggestedListing = SUGGEST_RE.test(body)
  SUGGEST_RE.lastIndex = 0
  body = body.replace(SUGGEST_RE, '')

  return { thinking, body: body.trim(), chips, suggestedListing }
}

/** Plain-text one-liner for the collapsed row preview: search trail and
 *  directives removed, card tokens replaced by their labels, markdown
 *  markers stripped. */
export function plainPreview(text: string): string {
  const { body } = parseMessage(text)
  return body
    .replace(/\[\[\s*card\s*:[^\]|\n]*\|([^\]\n]*)\]\]/gi, '$1')
    .replace(ANY_DIRECTIVE_RE, ' ')
    .replace(/\[([^\]\n]+)\]\([^)\n]+\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function renderInline(
  text: string,
  names: Record<string, string>
): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  INLINE_RE.lastIndex = 0

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const token = match[0]

    if (/^\[\[/.test(token)) {
      // Well-formed card/id tokens become inline badges; any other [[...]]
      // directive is malformed or already handled — drop it silently rather
      // than leaking raw brackets.
      const label = /^\[\[\s*(?:card|id)\s*:/i.test(token)
        ? inlineCardLabel(token, names)
        : ''
      if (label) {
        parts.push(
          <span key={`c-${key++}`} className={styles.convCardInline}>
            {label}
          </span>
        )
      }
    } else if (token.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (m) {
        parts.push(
          <a
            key={`l-${key++}`}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.convLink}
          >
            {m[1]}
          </a>
        )
      } else {
        parts.push(token)
      }
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>)
    } else {
      parts.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface CardSpec {
  type: string | null
  id: string
  note: string
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'ul'; lines: string[] }
  | { kind: 'ol'; lines: string[] }
  | { kind: 'cards'; cards: CardSpec[] }

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let current: Block | null = null

  const flush = () => {
    if (
      current &&
      ((current.kind === 'cards' && current.cards.length > 0) ||
        (current.kind !== 'cards' && current.lines.length > 0))
    ) {
      blocks.push(current)
    }
    current = null
  }

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (line === '') {
      flush()
      continue
    }
    const cardMatch = CARD_LINE_RE.exec(line)
    const ulMatch = /^\s*[-•]\s+(.+)$/.exec(line)
    const olMatch = /^\s*\d+\.\s+(.+)$/.exec(line)

    if (cardMatch) {
      if (current?.kind !== 'cards') {
        flush()
        current = { kind: 'cards', cards: [] }
      }
      current.cards.push({
        type: cardType(cardMatch[1]),
        id: cardMatch[1].replace(/\s+/g, ''),
        note: cardMatch[2]?.trim() ?? '',
      })
    } else if (ulMatch) {
      if (current?.kind !== 'ul') {
        flush()
        current = { kind: 'ul', lines: [] }
      }
      current.lines.push(ulMatch[1])
    } else if (olMatch) {
      if (current?.kind !== 'ol') {
        flush()
        current = { kind: 'ol', lines: [] }
      }
      current.lines.push(olMatch[1])
    } else {
      if (current?.kind !== 'paragraph') {
        flush()
        current = { kind: 'paragraph', lines: [] }
      }
      current.lines.push(line)
    }
  }
  flush()
  return blocks
}

function MessageBody({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  const names = useContext(ListingNamesContext)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'cards') {
          return (
            <div key={i} className={styles.convCards}>
              {block.cards.map((card, j) => {
                const name = resolveListingName(names, card.id)
                const rec = /rec[A-Za-z0-9]+/.exec(card.id)?.[0] ?? card.id
                // Prefer the real listing name; fall back to the note, then
                // the raw id, so a card is never blank.
                const primary = name ?? (card.note || rec)
                const showNote = Boolean(card.note) && card.note !== primary
                return (
                  <span key={j} className={styles.convCard}>
                    {card.type && (
                      <span className={styles.convCardType}>{card.type}</span>
                    )}
                    <span className={styles.convCardName}>{primary}</span>
                    {showNote && (
                      <span className={styles.convCardNote}>{card.note}</span>
                    )}
                  </span>
                )
              })}
            </div>
          )
        }
        if (block.kind === 'paragraph') {
          return <p key={i}>{renderInline(block.lines.join(' '), names)}</p>
        }
        const Tag = block.kind === 'ul' ? 'ul' : 'ol'
        return (
          <Tag key={i}>
            {block.lines.map((item, j) => (
              <li key={j}>
                <Fragment>{renderInline(item, names)}</Fragment>
              </li>
            ))}
          </Tag>
        )
      })}
    </>
  )
}

export default function TranscriptMessage({ text }: { text: string }) {
  const { thinking, body, chips, suggestedListing } = parseMessage(text)
  return (
    <div className={styles.convMsg}>
      {thinking && (
        <div className={styles.convThinking}>
          <span className={styles.convThinkingLabel}>Search trail</span>
          {plainPreview(thinking)}
        </div>
      )}
      <MessageBody text={body} />
      {suggestedListing && (
        <div className={styles.convSuggestNote}>
          Nothing matched — visitor was shown a &ldquo;Suggest a listing&rdquo;
          button
        </div>
      )}
      {chips.length > 0 && (
        <div className={styles.convChips}>
          {chips.map((chip, i) => (
            <span key={i} className={styles.convChip}>
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
