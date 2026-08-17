// Round history for the chatbot's get_program_history tool: every dated round
// of a training program or event the site has on file, past AND upcoming.
// The live catalog only holds what the resource pages show (rounds that
// haven't started/ended yet), so questions like "when have previous rounds
// run?" or "will there be another one in January?" need this separate index.
//
// Program names vary between rounds ("Pathfinder Fellowship: 2025",
// "Pathfinder Fellowship: Fall 2026", "ARENA 5.0" vs "Alignment Research
// Engineer Accelerator (ARENA) 7.0"), so matching is deliberately generous:
// rarity-weighted word overlap, plus a join on bracketed acronyms and on
// identical URLs. The model reads the returned names and sorts out
// sub-streams or sibling programs itself — under-inclusion is the failure
// that matters here, not a few extra rows.

import { getTrainingRounds, type ProgramRound } from '@/lib/data/training'
import { getEventRounds } from '@/lib/data/events'

export type RoundKind = 'training' | 'event'

export interface IndexedRound {
  round: ProgramRound
  kind: RoundKind
  /** Words from the name, host and URL — the strong identifiers. */
  identity: Set<string>
  /** Words from the description — a weaker signal, scored at half weight. */
  description: Set<string>
  /** Bracketed acronyms in the name, lower-cased ("mats", "aisc"). */
  acronyms: string[]
  /** Normalised URL for the identical-link join; null when there is none. */
  urlKey: string | null
}

interface RoundIndex {
  rounds: IndexedRound[]
  /** Inverse document frequency of every word across identity+description. */
  idf: Map<string, number>
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  // URL noise
  'www',
  'com',
  'org',
  'net',
  'io',
  'co',
  'uk',
  'edu',
  'html',
  'index',
])

// Words that name a particular iteration rather than the program itself, so
// a query built from "Pathfinder Fellowship: Fall 2026" still matches
// "Pathfinder Fellowship: Spring 2026" and "Pathfinder Fellowship: 2025".
const ITERATION_MARKERS = new Set([
  'spring',
  'summer',
  'autumn',
  'fall',
  'winter',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
  'cohort',
  'round',
  'edition',
  'batch',
  'intake',
  'iteration',
])

function isIterationMarker(token: string): boolean {
  if (ITERATION_MARKERS.has(token)) return true
  if (/^(19|20)\d\d$/.test(token)) return true // years
  if (/^\d{1,2}$/.test(token)) return true // '26, 5.0 → "5" "0", "11"
  if (/^\d+(st|nd|rd|th)$/.test(token)) return true // 11th
  if (/^q[1-4]$/.test(token)) return true // Q3
  return false
}

/** Split on anything non-alphanumeric ("AISC-4" → aisc, 4; "ERA:AI" →
 *  era, ai), lower-case, drop stopwords and one-character bits. Camel-cased
 *  names are also split at their humps ("EAGxBerlin" → eagx, berlin;
 *  "BlueDot" → blue, dot) alongside the whole word, and a word ending in
 *  digits also yields its stem ("ARBOx3" → arbox3, arbox), so spelling
 *  variants between rounds still meet. */
function words(text: string): string[] {
  const humps = text.replace(/([a-z])([A-Z])/g, '$1 $2')
  const out = new Set<string>()
  for (const t of `${text} ${humps}`.toLowerCase().split(/[^a-z0-9]+/)) {
    if (t.length < 2 || STOPWORDS.has(t)) continue
    out.add(t)
    const stem = /^([a-z]{3,})\d+$/.exec(t)?.[1]
    if (stem) out.add(stem)
  }
  return [...out]
}

/** Bracketed all-caps acronyms of 3–8 characters: "(MATS)", "(LASR)",
 *  "(ARENA)", "(AISC)" — but not "(online)", "(Berkeley)", "(1)", "(AI)" or
 *  "(Legal Frontiers)", none of which identify a program. */
function acronymsIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\(([A-Z0-9]{3,8})\)/g)) {
    out.push(m[1].toLowerCase())
  }
  return out
}

function urlWords(url: string): string[] {
  if (!url || url === '#') return []
  try {
    const u = new URL(url)
    return words(`${u.hostname} ${u.pathname}`)
  } catch {
    return []
  }
}

/** Same page under trivially different spellings compares equal. */
export function urlKeyOf(url: string | null | undefined): string | null {
  if (!url || url === '#') return null
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '')
    return `${host}${path}`
  } catch {
    return null
  }
}

function indexRound(round: ProgramRound, kind: RoundKind): IndexedRound {
  return {
    round,
    kind,
    identity: new Set([
      ...words(round.name),
      ...words(round.host ?? ''),
      ...urlWords(round.url),
    ]),
    description: new Set(words(round.description)),
    acronyms: acronymsIn(round.name),
    urlKey: urlKeyOf(round.url),
  }
}

function buildIndex(rounds: IndexedRound[]): RoundIndex {
  const df = new Map<string, number>()
  for (const r of rounds) {
    for (const t of new Set([...r.identity, ...r.description])) {
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }
  const idf = new Map<string, number>()
  for (const [t, n] of df) idf.set(t, Math.log(rounds.length / n))
  return { rounds, idf }
}

let cached: { index: RoundIndex; expiresAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

/** Both tables' rounds, indexed for matching. Memoised for five minutes like
 *  the catalog; the underlying Airtable reads are the same cached fetches
 *  the resource pages use, so this adds no extra Airtable traffic. */
export async function getRoundIndex(): Promise<RoundIndex> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.index
  const [training, events] = await Promise.all([
    getTrainingRounds(),
    getEventRounds(),
  ])
  const index = buildIndex([
    ...training.map(r => indexRound(r, 'training')),
    ...events.map(r => indexRound(r, 'event')),
  ])
  cached = { index, expiresAt: now + CACHE_TTL_MS }
  return index
}

export interface RoundQuery {
  /** Free text naming the program ("Pathfinder Fellowship", "MATS"). */
  text: string
  /** A known URL for the program (the input listing's link), for the
   *  identical-link join. */
  url?: string | null
}

export interface RoundMatch {
  entry: IndexedRound
  score: number
}

/** Cap on rounds returned to the model — plenty for any one program's
 *  history, small enough that a generic query can't flood the context. */
export const MAX_ROUNDS = 40

/** A round must score at least this fraction of the best match to be kept.
 *  Tuned on the live tables (Aug 2026): at 0.5, "EA Global London" dragged
 *  in every EA Global / EAGx / EA Summit (76 rows); at 0.6 it returns the
 *  London ones plus a couple of London look-alikes, while name variants of
 *  the same program ("Talos Fellowship – Spring 2025" vs "Talos Fellowship:
 *  Autumn 2026", all the GovAI fellowships) still clear the bar. */
const KEEP_FRACTION = 0.6

/** Words of the query that carry meaning for matching (iteration markers
 *  stripped). Exposed so the tool can explain an empty result. */
export function queryWords(text: string): string[] {
  return words(text).filter(t => !isIterationMarker(t))
}

/**
 * Rounds matching the query, best first, capped at MAX_ROUNDS.
 *
 * Score = summed rarity (idf) of the query words found in a round's identity
 * words, plus half rarity for words found only in its description. Rounds
 * scoring under KEEP_FRACTION of the best score are dropped — a common word
 * like "fellowship" alone can't drag in every fellowship once "pathfinder"
 * has set the bar. Then two joins widen the net for the same program under another
 * name: rounds carrying a bracketed acronym that the query or the best
 * matches carry ("MATS: Summer 2026" ↔ "ML Alignment & Theory Scholars
 * (MATS): Summer 2025"), and rounds sharing the identical link.
 */
export function searchRounds(
  index: RoundIndex,
  query: RoundQuery
): { matches: RoundMatch[]; total: number } {
  const tokens = queryWords(query.text)
  if (tokens.length === 0) return { matches: [], total: 0 }

  const scored: RoundMatch[] = []
  for (const entry of index.rounds) {
    let score = 0
    for (const t of tokens) {
      const w = index.idf.get(t)
      if (w === undefined) continue
      if (entry.identity.has(t)) score += w
      else if (entry.description.has(t)) score += w / 2
    }
    if (score > 0) scored.push({ entry, score })
  }
  if (scored.length === 0) return { matches: [], total: 0 }

  const best = Math.max(...scored.map(m => m.score))
  const kept = scored.filter(m => m.score >= best * KEEP_FRACTION)

  // Join keys: acronyms written in the query itself, acronyms and links of
  // the strongest matches, and the input listing's own link.
  const acronyms = new Set(acronymsIn(query.text))
  const urlKeys = new Set<string>()
  const inputUrl = urlKeyOf(query.url)
  if (inputUrl) urlKeys.add(inputUrl)
  for (const m of kept) {
    if (m.score < best) continue
    m.entry.acronyms.forEach(a => acronyms.add(a))
    if (m.entry.urlKey) urlKeys.add(m.entry.urlKey)
  }
  const keptIds = new Set(kept.map(m => m.entry.round.id))
  if (acronyms.size > 0 || urlKeys.size > 0) {
    for (const entry of index.rounds) {
      if (keptIds.has(entry.round.id)) continue
      const byAcronym = [...acronyms].some(a => entry.identity.has(a))
      const byUrl = entry.urlKey !== null && urlKeys.has(entry.urlKey)
      if (byAcronym || byUrl) {
        // Joined rounds rank as strong matches — the join is the evidence.
        kept.push({ entry, score: best })
        keptIds.add(entry.round.id)
      }
    }
  }

  kept.sort((a, b) => b.score - a.score)
  return { matches: kept.slice(0, MAX_ROUNDS), total: kept.length }
}
