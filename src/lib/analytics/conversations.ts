// Chatbot conversation stats for the admin analytics dashboard, derived from
// the Airtable conversation log (the same table the Conversation Log viewer
// reads). Everything here is computed per-query from the raw transcripts —
// nothing is precomputed or stored — so the panels are fully date-range aware.

import { franc } from 'franc-min'
import { PAGES, DEFAULT_CHIPS } from '@/lib/assistant/pages'
import {
  isConversationsTableConfigured,
  listConversationsForStats,
  type ConversationRow,
} from '@/lib/admin/airtable'
import type { Counted, DateRange } from './events'

export interface TopQuestion {
  /** The question as the first visitor to ask it typed it. */
  text: string
  /** Conversations that started with this question. */
  count: number
  /** True when it matches one of the chatbot's suggested-question chips. */
  suggested: boolean
}

export interface ConversationStats {
  /** False when the log table isn't configured or couldn't be reached; the
   *  dashboard shows a notice instead of the transcript-derived panels. */
  available: boolean
  /** Conversations created inside the selected range. */
  totalConversations: number
  /** Median user messages per conversation, or null with no data. */
  medianLength: number | null
  /** Share (0–1) of conversations whose first message is one of the suggested
   *  question chips, or null with no data. */
  suggestedShare: number | null
  /** Share (0–1) of conversations where the visitor clicked a listing card or
   *  link out of a reply, or null with no data. */
  clickedShare: number | null
  /** Conversations bucketed by how many messages the visitor sent. */
  lengthBuckets: Counted[]
  /** Conversations bucketed by auto-detected language, busiest first. */
  languages: Counted[]
  /** The most common conversation-opening questions, busiest first. */
  topQuestions: TopQuestion[]
}

const EMPTY_STATS: ConversationStats = {
  available: false,
  totalConversations: 0,
  medianLength: null,
  suggestedShare: null,
  clickedShare: null,
  lengthBuckets: [],
  languages: [],
  topQuestions: [],
}

/** Whitespace-collapsed lowercase form, for grouping repeats of one question
 *  and matching against the chip texts. */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Every suggested-question chip the site shows, normalized. First messages
 *  matching one of these were (almost certainly) started from a chip click.
 *  Matches the CURRENT chip set — if a chip's wording changes, conversations
 *  started from the old wording read as typed. */
const CHIP_TEXTS = new Set(
  [...PAGES.flatMap(p => p.chips), ...DEFAULT_CHIPS].map(normalize)
)

/** The visitor's messages in a conversation, oldest first. The stored history
 *  is windowed for long chats, so this can miss a long conversation's earliest
 *  messages; `data.user` (the latest message) covers rows with no history at
 *  all (e.g. an abandoned first turn). */
function userMessages(row: ConversationRow): string[] {
  const d = row.data
  if (!d) return []
  const fromHistory = d.history
    .filter(t => t.role === 'user')
    .map(t => t.content)
    .filter(Boolean)
  if (fromHistory.length > 0) return fromHistory
  return d.user ? [d.user] : []
}

/** How many messages the visitor sent, from the per-turn arrays the log
 *  appends to on every turn (turnTimes, else tools — one entry each per
 *  logged turn, never windowed). Falls back to counting the history's user
 *  messages for rows older than per-turn tracking. */
function conversationLength(row: ConversationRow): number {
  const d = row.data
  if (!d) return 0
  if (Array.isArray(d.turnTimes) && d.turnTimes.length > 0)
    return d.turnTimes.length
  if (Array.isArray(d.tools) && d.tools.length > 0) return d.tools.length
  return userMessages(row).length
}

/** ISO 639-3 codes franc may return here, mapped to display names. Detection
 *  is restricted to exactly these languages: a whitelist keeps short queries
 *  from being misread as exotic near-neighbours (e.g. English as Scots). */
const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English',
  spa: 'Spanish',
  por: 'Portuguese',
  fra: 'French',
  deu: 'German',
  nld: 'Dutch',
  ita: 'Italian',
  pol: 'Polish',
  ron: 'Romanian',
  ces: 'Czech',
  hun: 'Hungarian',
  ell: 'Greek',
  swe: 'Swedish',
  rus: 'Russian',
  ukr: 'Ukrainian',
  tur: 'Turkish',
  arb: 'Arabic',
  pes: 'Persian',
  hin: 'Hindi',
  ben: 'Bengali',
  urd: 'Urdu',
  tam: 'Tamil',
  tel: 'Telugu',
  mar: 'Marathi',
  cmn: 'Chinese',
  jpn: 'Japanese',
  kor: 'Korean',
  vie: 'Vietnamese',
  ind: 'Indonesian',
  tha: 'Thai',
}
const DETECTABLE = Object.keys(LANGUAGE_NAMES)

/** Best-effort language of a conversation, from everything the visitor wrote
 *  (concatenated — more text makes trigram detection much more reliable).
 *  'Unknown' when there's too little text to call. */
function detectLanguage(messages: string[]): string {
  const text = messages.join(' ').trim()
  if (!text) return 'Unknown'
  const code = franc(text, { only: DETECTABLE })
  return LANGUAGE_NAMES[code] ?? 'Unknown'
}

/** Bucket labels for the length distribution, in display order. */
const LENGTH_BUCKETS: { label: string; max: number }[] = [
  { label: '1 message', max: 1 },
  { label: '2 messages', max: 2 },
  { label: '3–5 messages', max: 5 },
  { label: '6–10 messages', max: 10 },
  { label: '11+ messages', max: Infinity },
]

function bucketFor(length: number): string {
  return LENGTH_BUCKETS.find(b => length <= b.max)!.label
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Cap on distinct questions sent to the browser — same reasoning as the click
 *  tables' row cap: organic data stays far below it. */
const MAX_QUESTIONS = 500

/** Compute the Chatbot tab's transcript-derived stats for a date range.
 *  Returns `available: false` instead of throwing when the log can't be read —
 *  a hiccup there must not take down the rest of the dashboard. */
export async function readConversationStats(
  range: DateRange
): Promise<ConversationStats> {
  if (!isConversationsTableConfigured()) return EMPTY_STATS
  let rows: ConversationRow[]
  try {
    rows = await listConversationsForStats(range)
  } catch (err) {
    console.warn(
      `[analytics] conversation stats read failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return EMPTY_STATS
  }

  const lengths: number[] = []
  const languages: string[] = []
  const questions = new Map<string, TopQuestion>()
  let withQuestion = 0
  let suggested = 0
  let clicked = 0

  for (const row of rows) {
    const messages = userMessages(row)
    const length = conversationLength(row)
    if (length > 0) {
      lengths.push(length)
      languages.push(detectLanguage(messages))
    }
    if (row.clickedCitations.length > 0) clicked += 1

    const first = messages[0]?.trim().replace(/\s+/g, ' ')
    if (!first) continue
    withQuestion += 1
    const key = first.toLowerCase()
    const isChip = CHIP_TEXTS.has(key)
    if (isChip) suggested += 1
    const q = questions.get(key)
    if (q) q.count += 1
    else questions.set(key, { text: first, count: 1, suggested: isChip })
  }

  const langCounts = new Map<string, number>()
  for (const l of languages) langCounts.set(l, (langCounts.get(l) ?? 0) + 1)

  const bucketCounts = new Map<string, number>()
  for (const l of lengths) {
    const b = bucketFor(l)
    bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1)
  }

  return {
    available: true,
    totalConversations: rows.length,
    medianLength: median(lengths.sort((a, b) => a - b)),
    suggestedShare: withQuestion > 0 ? suggested / withQuestion : null,
    clickedShare: rows.length > 0 ? clicked / rows.length : null,
    // Buckets in display order (1 → 11+), only the non-empty ones.
    lengthBuckets: LENGTH_BUCKETS.map(b => ({
      name: b.label,
      count: bucketCounts.get(b.label) ?? 0,
    })).filter(b => b.count > 0),
    languages: [...langCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    topQuestions: [...questions.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_QUESTIONS),
  }
}
