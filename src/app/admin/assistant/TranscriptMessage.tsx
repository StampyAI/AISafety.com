// Renders a stored assistant reply the way visitors saw it: markdown
// formatted, [[card:...]] lines as listing pills, [[chip:...]] tokens as
// suggestion chips, and the pre-[[/thinking]] search trail dimmed. The
// stored history has no resolvable citation objects, so card pills are
// label-driven (the text after the | in the token).

import { createContext, Fragment, ReactNode, useContext, useState } from 'react'
import styles from '../admin.module.css'

export interface ListingInfo {
  name: string
  logo?: string
  /** External listing URL (the live card's destination). */
  url?: string
  /** AISafety.com resource-page link, used when there's no external URL. */
  pageUrl?: string
}

/** id → listing {name, logo}, supplied by the conversations API so card pills
 *  can show which listing they are (the stored token only has the id + note). */
export const ListingInfoContext = createContext<Record<string, ListingInfo>>({})

/** Set of listing ids (full and bare-rec forms) whose cards the visitor
 *  clicked in this conversation, so the viewer can badge them. */
export const ClickedCardsContext = createContext<Set<string>>(new Set())

/** Resolve a card token's id to its listing info: try the full id, then the
 *  bare rec id (handles tokens written without a type prefix). */
function resolveListing(
  listings: Record<string, ListingInfo>,
  id: string
): ListingInfo | null {
  const cleaned = id.replace(/\s+/g, '')
  if (listings[cleaned]) return listings[cleaned]
  const rec = /rec[A-Za-z0-9]+/.exec(cleaned)?.[0]
  if (rec && listings[rec]) return listings[rec]
  return null
}

// Boundary between the model's reasoning (the dimmed "search trail") and its
// answer. Require the slash and use the LAST occurrence, mirroring the live
// streaming renderer (ChatBody): if the model drafts a reply, searches again,
// and restarts, everything up to the final [[/thinking]] is reasoning and only
// the text after it is the answer — so an abandoned first draft doesn't double
// up in the body.
const THINKING_DONE_RE = /\[\[\s*\/\s*thinking\s*\]\]/gi

function lastThinkingDone(
  text: string
): { index: number; length: number } | null {
  THINKING_DONE_RE.lastIndex = 0
  let last: RegExpExecArray | null = null
  for (
    let m = THINKING_DONE_RE.exec(text);
    m;
    m = THINKING_DONE_RE.exec(text)
  ) {
    last = m
  }
  return last ? { index: last.index, length: last[0].length } : null
}
const CHIP_RE = /\[\[\s*chip\s*:([^\]\n]*)\]\]/gi
const SUGGEST_RE = /\[\[\s*suggest\s*:[^\]\n]*\]\]/gi
const CARD_LINE_RE =
  /^\s*\[\[\s*card\s*:\s*([^\]|\n]+?)(?:\s*\|([^\]\n]*))?\s*\]\]\s*$/i
const INLINE_RE =
  /(\[\[[^\]\n]*\]\])|(\[[^\]\n]+\]\(\/?[^)\n]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\baisafety\.info(?:\/[^\s<>),]*)?)/gi

/** "job:recXXX" → "job"; bare rec ids have no type. */
function cardType(rawId: string): string | null {
  const cleaned = rawId.replace(/\s+/g, '')
  const m = /^([a-z-]+):/i.exec(cleaned)
  return m ? m[1].toLowerCase() : null
}

/** Human label for an inline card/id token: prefer the resolved listing
 *  name, then the |label, then the type prefix, then the bare rec id. */
function inlineCardLabel(
  token: string,
  listings: Record<string, ListingInfo>
): string {
  const m =
    /^\[\[\s*(?:card|id)\s*:\s*([^\]|\n]+?)(?:\s*\|([^\]\n]*))?\s*\]\]$/i.exec(
      token
    )
  if (!m) return ''
  const info = resolveListing(listings, m[1])
  if (info) return info.name
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
  const marker = lastThinkingDone(text)
  const thinking = marker ? text.slice(0, marker.index).trim() || null : null
  let body = marker ? text.slice(marker.index + marker.length) : text

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

/** Wraps an inline link with a "clicked" badge when the visitor opened it.
 *  Link clicks are stored in the same Clicked set as cards, keyed `link:<href>`. */
function inlineLink(
  href: string,
  text: ReactNode,
  clicked: Set<string>,
  key: string
): ReactNode {
  const wasClicked = clicked.has(`link:${href}`)
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.convLink}${wasClicked ? ` ${styles.convLinkClicked}` : ''}`}
    >
      {text}
      {wasClicked && (
        <span
          className={styles.convLinkClickedTag}
          title="The user clicked this link"
        >
          ✓
        </span>
      )}
    </a>
  )
}

function renderInline(
  text: string,
  listings: Record<string, ListingInfo>,
  clicked: Set<string>
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
        ? inlineCardLabel(token, listings)
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
        parts.push(inlineLink(m[2], m[1], clicked, `l-${key++}`))
      } else {
        parts.push(token)
      }
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>)
    } else if (/^aisafety\.info/i.test(token)) {
      // Auto-linkify bare aisafety.info mentions, matching the live renderer
      // (the bot writes it as plain text rather than a markdown link).
      parts.push(inlineLink(`https://${token}`, token, clicked, `u-${key++}`))
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

  let pendingBlank = false
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (line === '') {
      // A blank line between two items of the same list is a loose-list
      // separator (normal Markdown), not a list break — defer the decision
      // until we see the next line. Any other blank line ends the block as
      // before. Mirrors the live renderer (MessageContent) so the admin
      // transcript shows the same numbering visitors saw.
      if (current && (current.kind === 'ul' || current.kind === 'ol')) {
        pendingBlank = true
      } else {
        flush()
      }
      continue
    }
    const cardMatch = CARD_LINE_RE.exec(line)
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

function CardPill({ card }: { card: CardSpec }) {
  const listings = useContext(ListingInfoContext)
  const clicked = useContext(ClickedCardsContext)
  const [imgFailed, setImgFailed] = useState(false)
  const info = resolveListing(listings, card.id)
  const rec = /rec[A-Za-z0-9]+/.exec(card.id)?.[0] ?? card.id
  // Prefer the real listing name; fall back to the note, then the raw id, so
  // a card is never blank.
  const primary = info?.name ?? (card.note || rec)
  const showNote = Boolean(card.note) && card.note !== primary
  const showLogo = Boolean(info?.logo) && !imgFailed
  const wasClicked = clicked.has(card.id) || clicked.has(rec)
  // No resolvable listing for this id — the model fabricated/guessed it without
  // a search, so the live renderer dropped this card entirely. Flag it so a
  // reviewer can tell it apart from a real card (it can't be made clickable).
  const unresolved = !info
  // Link to the listing's external URL (what the live card opens); fall back
  // to its AISafety.com resource page when there's no usable external URL.
  const href =
    info?.url && /^https?:\/\//.test(info.url) ? info.url : info?.pageUrl
  const className = `${styles.convCard}${wasClicked ? ` ${styles.convCardClickedRow}` : ''}${href ? ` ${styles.convCardLink}` : ''}${unresolved ? ` ${styles.convCardUnresolved}` : ''}`
  const inner = (
    <>
      {showLogo ? (
        // Plain <img>: logos are tiny favicons/cdn URLs from third-party
        // hosts, so next/image's pipeline buys us nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info!.logo}
          alt=""
          width={18}
          height={18}
          className={styles.convCardLogo}
          onError={() => setImgFailed(true)}
        />
      ) : null}
      {card.type && <span className={styles.convCardType}>{card.type}</span>}
      <span className={styles.convCardName}>{primary}</span>
      {showNote && <span className={styles.convCardNote}>{card.note}</span>}
      {unresolved && (
        <span
          className={styles.convCardUnresolvedTag}
          title="No listing matched this id — the model fabricated it without a search, so the live card was dropped"
        >
          unresolved
        </span>
      )}
      {wasClicked && <span className={styles.convCardClicked}>✓ clicked</span>}
    </>
  )
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {inner}
    </a>
  ) : (
    <span className={className}>{inner}</span>
  )
}

function MessageBody({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  const listings = useContext(ListingInfoContext)
  const clicked = useContext(ClickedCardsContext)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'cards') {
          return (
            <div key={i} className={styles.convCards}>
              {block.cards.map((card, j) => (
                <CardPill key={j} card={card} />
              ))}
            </div>
          )
        }
        if (block.kind === 'paragraph') {
          return (
            <p key={i}>
              {renderInline(block.lines.join(' '), listings, clicked)}
            </p>
          )
        }
        const Tag = block.kind === 'ul' ? 'ul' : 'ol'
        return (
          <Tag key={i}>
            {block.lines.map((item, j) => (
              <li key={j}>
                <Fragment>{renderInline(item, listings, clicked)}</Fragment>
              </li>
            ))}
          </Tag>
        )
      })}
    </>
  )
}

export default function TranscriptMessage({ text }: { text: string }) {
  // The reasoning/search trail before the [[/thinking]] boundary is dropped
  // here: it's never shown to visitors (the live chat hides it), and it adds
  // noise to the admin transcript. parseMessage still splits it off so it
  // stays out of the body below.
  const { body, chips, suggestedListing } = parseMessage(text)
  return (
    <div className={styles.convMsg}>
      <MessageBody text={body} />
      {suggestedListing && (
        <div className={styles.convSuggestNote}>
          Nothing matched — user was shown a &ldquo;Suggest a listing&rdquo;
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
