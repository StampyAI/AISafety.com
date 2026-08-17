/*
  Airtable schema for the admin conversation log.

  ─── assistant_conversations ───
  ID env var: ADMIN_CONVERSATIONS_TABLE_ID
  One row per CONVERSATION (keyed by Session). Each turn updates the row
  in place: refresh the latest fields, replace Data.history with the
  latest turn's window (the widget resends the whole conversation each
  turn; the route windows it to the last 50 messages before logging),
  accumulate Data.tools/citations.

  Fields:
    Session         (single line text)  — natural key
    Page            (single line text)  — page the conversation started on
    Latency ms      (number)            — latest turn's latency
    Prompt version  (single line text)  — latest, e.g. "2026-05-07-1"
    Notes           (long text)         — admin annotations
    Tags            (multi-select)      — admin annotations
    Created at      (created time)      — auto, first-turn timestamp
    Data            (long text)         — JSON payload, see ConversationData
                                          below for shape
    Clicked         (long text)         — JSON array of click keys, written
                                          out-of-band by the click logger
    Ratings         (long text)         — JSON map of turn index → 'up'/'down',
                                          written out-of-band by the rating
                                          logger
    Delivery        (long text)         — JSON map of turn index → what the
                                          visitor's browser reported about
                                          the reply (received / stopped /
                                          left the page mid-answer, panel
                                          closed, tab hidden, seen later); see
                                          TurnDelivery. Written out-of-band by
                                          the delivery logger

  Prompt drafts are NOT persisted to Airtable. They live in browser
  localStorage in the admin editor. Production prompts ship via code.
*/

const TOKEN = process.env.AIRTABLE_TOKEN
const BASE = process.env.AIRTABLE_BASE_ID
const CONVERSATIONS_TABLE = process.env.ADMIN_CONVERSATIONS_TABLE_ID
// Ceiling for the serialized Data JSON, under Airtable's 100,000-character
// long-text limit with margin. See upsertConversation.
const MAX_DATA_CHARS = 90_000

// Permanent Airtable field IDs for the conversations table. All reads set
// returnFieldsByFieldId and all writes key fields by ID, so renaming a
// field in Airtable can't break the log.
const FIELD = {
  session: 'flds7cVOnzozLsaAl', // Session
  page: 'fld36UU20Zc9JNvHt', // Page
  latencyMs: 'fldD1AMzmTp4EVQUq', // Latency ms
  promptVersion: 'fldZi6qb5G5bsdfFH', // Prompt version
  notes: 'fldpjWWpS9R0cFXRU', // Notes
  tags: 'fldAkUlONRN894SZN', // Tags
  data: 'fld9TbBixMYVOssja', // Data
  clicked: 'fld3PKIZx3Oo1oxkm', // Clicked
  ratings: 'fld0ZRhDFjpcHTJnm', // Ratings
  delivery: 'fld2HdrWqxHN7BSTH', // Delivery
  createdAt: 'fldterZrwZHKm2taI', // Created at
} as const

function ensureConfig(table: string | undefined): asserts table is string {
  if (!TOKEN || !BASE) {
    throw new Error('Airtable credentials missing (AIRTABLE_TOKEN/BASE_ID)')
  }
  if (!table) {
    throw new Error('Admin Airtable table id missing in env')
  }
}

interface AirtableRow<F> {
  id: string
  createdTime: string
  fields: F
}

interface AirtableListResponse<F> {
  records: AirtableRow<F>[]
  offset?: string
}

async function airtableRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
}

async function listAll<F>(
  table: string,
  params: URLSearchParams = new URLSearchParams()
): Promise<AirtableRow<F>[]> {
  const out: AirtableRow<F>[] = []
  let offset: string | undefined
  do {
    const search = new URLSearchParams(params)
    if (offset) search.set('offset', offset)
    const url = `${table}?${search.toString()}`
    const res = await airtableRequest(url)
    if (!res.ok) {
      throw new Error(`Airtable list failed: ${res.status} ${await res.text()}`)
    }
    const data = (await res.json()) as AirtableListResponse<F>
    out.push(...data.records)
    offset = data.offset
  } while (offset)
  return out
}

// ─── Conversation log ───────────────────────────────────────────────────────

export interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Name/url snapshot of a cited listing, captured at log time so the viewer
 *  can still render a card after the listing is deleted from the catalog
 *  (events especially get cycled out once they end). */
export interface StoredCitation {
  id: string
  name: string
  /** The org behind the listing (a job's hiring org, a course's creator).
   *  Absent on rows logged before it was captured. */
  organization?: string
  url: string
  logo?: string
}

/** Shape of the JSON stored in the `Data` column. */
export interface ConversationData {
  user: string
  response: string
  /** The conversation as of the latest turn, WINDOWED: the last 50 messages
   *  (25 exchanges; rows written before 17 Aug 2026 kept only the model's
   *  14-message window), then trimmed further if the row would overflow
   *  Airtable's long-text limit. Per-turn arrays (`tools`, `turnTimes`,
   *  `pages`) are never windowed, so their length is the true turn count and
   *  they align with `history` from the END. */
  history: HistoryTurn[]
  tools: unknown[]
  /** One entry per logged turn (aligned with `tools`): card ids in that
   *  turn's reply that rendered as a generic "Browse X" fallback link (or
   *  nothing) in the visitor's chat instead of a real card. Absent on rows
   *  written before this was tracked. */
  fallbackCards?: unknown[]
  /** One entry per logged turn (aligned with `tools`): ISO timestamp of when
   *  that turn's user message arrived. Absent on rows written before this was
   *  tracked. */
  turnTimes?: unknown[]
  /** One entry per logged turn (aligned with `tools`): the site page the
   *  visitor was on when they sent that turn's message. The Page FIELD only
   *  holds one value, so mid-conversation navigation is recorded here. Absent
   *  on rows written before this was tracked. */
  pages?: unknown[]
  citations: string[]
  /** Resolved name/url for each cited listing, so cards survive deletion. */
  citationRefs: StoredCitation[]
  geo: { city?: string; region?: string; country?: string } | null
  referrer: string | null
  utm: Record<string, string> | null
  pageState: Record<string, unknown> | null
  zeroMatches: boolean
  /** Set when the latest turn didn't complete: 'abandoned' (the visitor's
   *  connection dropped — tab closed or Stop pressed — before generation
   *  finished; `response` holds whatever had streamed by then, possibly
   *  nothing) or 'error' (generation failed). Absent on normal turns. */
  status?: 'abandoned' | 'error'
}

/** What the visitor's browser reported about one reply — the signals the
 *  server can't see. Every duration is milliseconds from the moment the
 *  visitor sent their message. Exactly one of received/stopped/error/left is
 *  expected per turn (the outcome); the rest are context around it. Absent
 *  entirely on turns from before this was tracked, on browsers the owner
 *  excluded from logging, and when the report never reached us (e.g. the tab
 *  was closed and the browser dropped the final request). */
export interface TurnDelivery {
  /** The stream finished in the visitor's browser — the whole reply arrived. */
  received?: number
  /** The visitor pressed Stop (or cleared the chat) mid-reply. */
  stopped?: number
  /** The browser hit an error mid-reply (network drop, malformed frame). */
  error?: number
  /** The page was unloaded (tab closed, full navigation) mid-reply. */
  left?: number
  /** The chat panel was closed while the reply was still streaming (first
   *  time it happened during this turn). */
  panelClosed?: number
  /** The tab went to the background while the reply was still streaming
   *  (first time). */
  tabHidden?: number
  /** Whether the chat panel was open at the moment of the outcome. */
  panelOpen?: boolean
  /** Whether the tab was visible at the moment of the outcome. */
  tabVisible?: boolean
  /** A reply that arrived with the panel closed or the tab hidden was later
   *  brought into view (panel reopened / tab refocused). Absent means it
   *  hadn't been, as of the last report. */
  seen?: number
}
export type DeliveryByTurn = Record<string, TurnDelivery>

const DELIVERY_NUMBER_KEYS = [
  'received',
  'stopped',
  'error',
  'left',
  'panelClosed',
  'tabHidden',
  'seen',
] as const
const DELIVERY_BOOLEAN_KEYS = ['panelOpen', 'tabVisible'] as const

/** Raw record fields, keyed by permanent field ID (see FIELD above). The
 *  Clicked field holds a JSON array of listing ids whose cards the visitor
 *  clicked — kept separate from Data so a click write never clobbers a turn
 *  write. */
type ConversationFields = Record<string, unknown>

export interface ConversationRow {
  id: string
  createdAt: string
  session: string
  page: string
  latencyMs: number | null
  promptVersion: string
  notes: string
  tags: string[]
  data: ConversationData | null
  /** Listing ids whose cards the visitor clicked during this conversation. */
  clickedCitations: string[]
  /** Visitor's thumbs ratings of the bot's replies, keyed by the reply's index
   *  in the message list ('up' | 'down'). Empty when nothing was rated. */
  ratings: MessageRatings
  /** What the visitor's browser reported about each reply (did it arrive, was
   *  the panel open, did they leave mid-answer…), keyed by the reply's index
   *  in the message list. Empty when nothing was reported. */
  delivery: DeliveryByTurn
}

export type MessageRatingValue = 'up' | 'down'
export type MessageRatings = Record<string, MessageRatingValue>

const EMPTY_DATA: ConversationData = {
  user: '',
  response: '',
  history: [],
  tools: [],
  citations: [],
  citationRefs: [],
  geo: null,
  referrer: null,
  utm: null,
  pageState: null,
  zeroMatches: false,
}

function parseData(raw: string | undefined): ConversationData | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ConversationData>
    return { ...EMPTY_DATA, ...parsed }
  } catch {
    return null
  }
}

/** Dedupe citation snapshots by id, keeping the last occurrence (most recent
 *  turn's name/url wins if a listing was cited more than once). */
function dedupeCitationRefs(refs: StoredCitation[]): StoredCitation[] {
  const byId = new Map<string, StoredCitation>()
  for (const r of refs) byId.set(r.id, r)
  return [...byId.values()]
}

/** The Clicked field holds a JSON array of listing-id strings. */
function parseClicked(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

/** The Ratings field holds a JSON object of turn index → 'up' | 'down'.
 *  Anything malformed (or any entry that isn't a valid rating) is dropped. */
function parseRatings(raw: string | undefined): MessageRatings {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const out: MessageRatings = {}
    for (const [turn, value] of Object.entries(parsed)) {
      if (value === 'up' || value === 'down') out[turn] = value
    }
    return out
  } catch {
    return {}
  }
}

/** The Delivery field holds a JSON object of turn index → TurnDelivery. Each
 *  entry is rebuilt from only the known keys with the right types, so a
 *  malformed value can't leak odd shapes into the viewer. */
function parseDelivery(raw: string | undefined): DeliveryByTurn {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const out: DeliveryByTurn = {}
    for (const [turn, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const v = value as Record<string, unknown>
      const entry: TurnDelivery = {}
      for (const key of DELIVERY_NUMBER_KEYS) {
        if (typeof v[key] === 'number') entry[key] = v[key]
      }
      for (const key of DELIVERY_BOOLEAN_KEYS) {
        if (typeof v[key] === 'boolean') entry[key] = v[key]
      }
      if (Object.keys(entry).length > 0) out[turn] = entry
    }
    return out
  } catch {
    return {}
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function rowToConversation(
  row: AirtableRow<ConversationFields>
): ConversationRow {
  const f = row.fields
  const latency = f[FIELD.latencyMs]
  const tags = f[FIELD.tags]
  return {
    id: row.id,
    createdAt: row.createdTime,
    session: str(f[FIELD.session]),
    page: str(f[FIELD.page]),
    latencyMs: typeof latency === 'number' ? latency : null,
    promptVersion: str(f[FIELD.promptVersion]),
    notes: str(f[FIELD.notes]),
    tags: Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === 'string')
      : [],
    data: parseData(str(f[FIELD.data]) || undefined),
    clickedCitations: parseClicked(str(f[FIELD.clicked]) || undefined),
    ratings: parseRatings(str(f[FIELD.ratings]) || undefined),
    delivery: parseDelivery(str(f[FIELD.delivery]) || undefined),
  }
}

/** One batch of conversations, newest first, plus an opaque cursor for the
 *  next batch (null when there are no older conversations left). Used by the
 *  admin viewer's "Load more" button so it only fetches what it shows rather
 *  than the whole — ever-growing — log on every load. */
/** Airtable filterByFormula that matches rows whose content contains every word
 *  in `search` (case-insensitive, any order). Searches the conversation JSON
 *  plus the page and notes. Returns undefined for a blank search. */
function searchFormula(search: string | undefined): string | undefined {
  // Strip quotes/backslashes that would break the formula string, then split
  // into words so "fast grants" matches a chat containing both words anywhere.
  const words = (search ?? '')
    .replace(/["\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return undefined
  const haystack = `LOWER({${FIELD.data}} & " " & {${FIELD.page}} & " " & {${FIELD.notes}})`
  const terms = words.map(w => `SEARCH(LOWER("${w}"), ${haystack})`)
  return terms.length === 1 ? terms[0] : `AND(${terms.join(', ')})`
}

export async function listConversationsPage(opts: {
  pageSize?: number
  /** Airtable cursor returned by a previous call; omit for the first page. */
  offset?: string
  /** Free-text filter across the conversation content (omit for all). */
  search?: string
}): Promise<{ conversations: ConversationRow[]; offset: string | null }> {
  ensureConfig(CONVERSATIONS_TABLE)
  const want = Math.max(1, opts.pageSize ?? 200)
  const formula = searchFormula(opts.search)
  const out: AirtableRow<ConversationFields>[] = []
  // Airtable caps a single request at 100 records, so loop until we've
  // gathered `want` (or run out), carrying Airtable's offset between requests.
  let cursor: string | undefined = opts.offset
  do {
    const params = new URLSearchParams()
    params.set('pageSize', String(Math.min(100, want - out.length)))
    params.set('sort[0][field]', FIELD.createdAt)
    params.set('sort[0][direction]', 'desc')
    params.set('returnFieldsByFieldId', 'true')
    if (formula) params.set('filterByFormula', formula)
    if (cursor) params.set('offset', cursor)
    const res = await airtableRequest(
      `${CONVERSATIONS_TABLE}?${params.toString()}`
    )
    if (!res.ok) {
      throw new Error(`Airtable list failed: ${res.status} ${await res.text()}`)
    }
    const data = (await res.json()) as AirtableListResponse<ConversationFields>
    out.push(...data.records)
    cursor = data.offset
  } while (cursor && out.length < want)
  return {
    conversations: out.map(rowToConversation),
    offset: cursor ?? null,
  }
}

/** Every conversation created inside the given window (epoch-ms bounds, either
 *  side open), fetched with only the fields the analytics dashboard's chatbot
 *  panels read — Data (the transcript), Clicked and Ratings — so the payload
 *  stays as small as the ever-growing log allows. */
export async function listConversationsForStats(range: {
  startMs: number | null
  endMs: number | null
}): Promise<ConversationRow[]> {
  ensureConfig(CONVERSATIONS_TABLE)
  // IS_AFTER/IS_BEFORE are strict, so widen each bound by 1ms to keep the
  // range's own endpoints included.
  const parts: string[] = []
  if (range.startMs != null) {
    const iso = new Date(range.startMs - 1).toISOString()
    parts.push(`IS_AFTER(CREATED_TIME(), '${iso}')`)
  }
  if (range.endMs != null) {
    const iso = new Date(range.endMs + 1).toISOString()
    parts.push(`IS_BEFORE(CREATED_TIME(), '${iso}')`)
  }
  const params = new URLSearchParams()
  if (parts.length > 0) {
    params.set(
      'filterByFormula',
      parts.length === 1 ? parts[0] : `AND(${parts.join(', ')})`
    )
  }
  params.set('returnFieldsByFieldId', 'true')
  params.append('fields[]', FIELD.data)
  params.append('fields[]', FIELD.clicked)
  params.append('fields[]', FIELD.ratings)
  const rows = await listAll<ConversationFields>(CONVERSATIONS_TABLE, params)
  return rows.map(rowToConversation)
}

export async function updateConversation(
  id: string,
  patch: { notes?: string; tags?: string[] }
): Promise<ConversationRow> {
  ensureConfig(CONVERSATIONS_TABLE)
  const fields: ConversationFields = {}
  if (patch.notes !== undefined) fields[FIELD.notes] = patch.notes
  if (patch.tags !== undefined) fields[FIELD.tags] = patch.tags
  const res = await airtableRequest(`${CONVERSATIONS_TABLE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  })
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${res.status} ${await res.text()}`)
  }
  return rowToConversation(
    (await res.json()) as AirtableRow<ConversationFields>
  )
}

async function findConversationBySession(
  session: string
): Promise<AirtableRow<ConversationFields> | null> {
  ensureConfig(CONVERSATIONS_TABLE)
  // Escape any double-quotes for the formula literal.
  const escaped = session.replace(/"/g, '\\"')
  const params = new URLSearchParams()
  params.set('filterByFormula', `{${FIELD.session}} = "${escaped}"`)
  params.set('maxRecords', '1')
  params.set('returnFieldsByFieldId', 'true')
  const res = await airtableRequest(
    `${CONVERSATIONS_TABLE}?${params.toString()}`
  )
  if (!res.ok) {
    throw new Error(`Airtable lookup failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as AirtableListResponse<ConversationFields>
  return data.records[0] ?? null
}

export async function upsertConversation(input: {
  /** ISO timestamp of when this turn's user message arrived. */
  turnAt: string
  session: string | null
  page: string
  user: string
  response: string
  history: HistoryTurn[]
  tools: unknown
  fallbackCards: string[]
  citations: string[]
  citationRefs: StoredCitation[]
  geo: ConversationData['geo']
  referrer: string | null
  utm: Record<string, string> | null
  pageState: Record<string, unknown> | null
  latencyMs: number
  zeroMatches: boolean
  status?: 'abandoned' | 'error'
  promptVersion: string
}): Promise<void> {
  ensureConfig(CONVERSATIONS_TABLE)

  // Without a session id we can't dedupe across turns; just create a new row.
  const existing = input.session
    ? await findConversationBySession(input.session)
    : null
  const previous = existing
    ? parseData(str(existing.fields[FIELD.data]) || undefined)
    : null

  const data: ConversationData = {
    user: input.user,
    response: input.response,
    history: input.history,
    tools: previous ? [...previous.tools, input.tools] : [input.tools],
    // Same per-turn alignment as tools. Older rows have no fallbackCards key;
    // starting the array now still aligns because the viewer matches turns
    // from the END (same trick it already uses for tools vs a windowed
    // history) — pre-tracking turns simply resolve to no entry.
    fallbackCards: previous
      ? [...(previous.fallbackCards ?? []), input.fallbackCards]
      : [input.fallbackCards],
    turnTimes: previous
      ? [...(previous.turnTimes ?? []), input.turnAt]
      : [input.turnAt],
    pages: previous ? [...(previous.pages ?? []), input.page] : [input.page],
    citations: previous
      ? Array.from(new Set([...previous.citations, ...input.citations]))
      : input.citations,
    // Accumulate name/url snapshots across turns, deduped by id (latest wins).
    citationRefs: dedupeCitationRefs([
      ...(previous?.citationRefs ?? []),
      ...input.citationRefs,
    ]),
    geo: input.geo,
    referrer: input.referrer,
    utm: input.utm,
    pageState: input.pageState,
    // Sticky once any turn returned no matches.
    zeroMatches: (previous?.zeroMatches ?? false) || input.zeroMatches,
    // Reflects the latest turn only (unlike zeroMatches): if a visitor
    // abandoned or errored a turn and then asked again successfully, the row
    // is no longer flagged. Omitted entirely on a normal turn.
    ...(input.status ? { status: input.status } : {}),
  }

  // Airtable rejects long-text values over 100,000 characters, and a rejected
  // write loses the whole turn. The route already windows history to 50
  // messages, which fits comfortably at typical message sizes; this is the
  // backstop for the rare chat of very long replies. Drop the oldest messages
  // until the serialized row fits — the transcript viewer already handles a
  // window that opens mid-exchange, and the per-turn arrays keep the true
  // turn count.
  let serialized = JSON.stringify(data)
  while (serialized.length > MAX_DATA_CHARS && data.history.length > 2) {
    data.history = data.history.slice(1)
    serialized = JSON.stringify(data)
  }

  const fields: ConversationFields = {
    [FIELD.session]: input.session ?? '',
    // The page where the conversation STARTED — written on create, never
    // patched. It has to match the greeting the visitor actually saw, and a
    // real conversation once got stamped /self-study because its last turn
    // overwrote the /map it began on. Per-turn pages (including any
    // mid-conversation navigation) live in Data's `pages` array.
    ...(existing ? {} : { [FIELD.page]: input.page }),
    [FIELD.latencyMs]: input.latencyMs,
    [FIELD.promptVersion]: input.promptVersion,
    [FIELD.data]: serialized,
  }

  const res = existing
    ? await airtableRequest(`${CONVERSATIONS_TABLE}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      })
    : await airtableRequest(CONVERSATIONS_TABLE, {
        method: 'POST',
        body: JSON.stringify({ fields }),
      })

  if (!res.ok) {
    const verb = existing ? 'update' : 'append'
    throw new Error(
      `Airtable ${verb} failed: ${res.status} ${await res.text()}`
    )
  }
}

/** Records that the visitor clicked a listing's card during a conversation.
 *  Reads-modifies-writes only the Clicked field (disjoint from the turn
 *  upsert's fields, so concurrent writes don't clobber each other). No-ops if
 *  the conversation row doesn't exist yet or the click is already recorded. */
export async function recordCitationClick(
  session: string,
  citationId: string
): Promise<void> {
  ensureConfig(CONVERSATIONS_TABLE)
  const existing = await findConversationBySession(session)
  // The turn write (via after()) usually lands before the visitor can click,
  // but if the row isn't there yet we simply drop the click rather than
  // creating a dataless row.
  if (!existing) return
  const current = parseClicked(str(existing.fields[FIELD.clicked]) || undefined)
  if (current.includes(citationId)) return
  const next = [...current, citationId]
  const res = await airtableRequest(`${CONVERSATIONS_TABLE}/${existing.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { [FIELD.clicked]: JSON.stringify(next) },
    }),
  })
  if (!res.ok) {
    throw new Error(
      `Airtable click update failed: ${res.status} ${await res.text()}`
    )
  }
}

/** Records the visitor's thumbs rating of one bot reply. Reads-modifies-writes
 *  only the Ratings field (disjoint from the turn upsert's fields and from
 *  Clicked, so none of the three writers can clobber another). A switched
 *  thumb overwrites the earlier value for that turn; re-sending the same value
 *  is a no-op. Like clicks, a rating that arrives before the conversation row
 *  exists is dropped rather than creating a dataless row. */
export async function recordMessageRating(
  session: string,
  turnIndex: number,
  value: MessageRatingValue
): Promise<void> {
  ensureConfig(CONVERSATIONS_TABLE)
  const existing = await findConversationBySession(session)
  if (!existing) return
  const current = parseRatings(str(existing.fields[FIELD.ratings]) || undefined)
  const key = String(turnIndex)
  if (current[key] === value) return
  const next: MessageRatings = { ...current, [key]: value }
  const res = await airtableRequest(`${CONVERSATIONS_TABLE}/${existing.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { [FIELD.ratings]: JSON.stringify(next) },
    }),
  })
  if (!res.ok) {
    throw new Error(
      `Airtable rating update failed: ${res.status} ${await res.text()}`
    )
  }
}

// How long to wait for a conversation's row to appear before giving up on a
// delivery report (see recordTurnDelivery).
const DELIVERY_ROW_WAIT_ATTEMPTS = 4
const DELIVERY_ROW_WAIT_MS = 1500

/** Records what the visitor's browser reported about one reply. Merges the
 *  patch into that turn's entry, so the outcome ('received' with the panel
 *  state) and a later 'seen' land in the same object. Reads-modifies-writes
 *  only the Delivery field — its own column, like Clicked and Ratings, so
 *  none of the out-of-band writers can clobber the turn upsert or each other.
 *
 *  Unlike clicks and ratings, the main report ('received') fires the instant
 *  the stream ends in the browser — the same moment the server's own turn
 *  write starts (in after(), once the stream closes). On a conversation's
 *  FIRST turn the row usually doesn't exist yet when the report arrives, so
 *  rather than dropping it we wait briefly for the row. Still missing after
 *  that (the turn write failed, or the browser is excluded from logging)
 *  → warn and drop, never create a dataless row. */
export async function recordTurnDelivery(
  session: string,
  turnIndex: number,
  patch: Partial<TurnDelivery>
): Promise<void> {
  ensureConfig(CONVERSATIONS_TABLE)
  let existing = await findConversationBySession(session)
  for (
    let attempt = 0;
    !existing && attempt < DELIVERY_ROW_WAIT_ATTEMPTS;
    attempt++
  ) {
    await new Promise(resolve => setTimeout(resolve, DELIVERY_ROW_WAIT_MS))
    existing = await findConversationBySession(session)
  }
  if (!existing) {
    console.warn(
      `[assistant] delivery report dropped — no conversation row for session ${session} after ${(DELIVERY_ROW_WAIT_ATTEMPTS * DELIVERY_ROW_WAIT_MS) / 1000}s`
    )
    return
  }
  const current = parseDelivery(
    str(existing.fields[FIELD.delivery]) || undefined
  )
  const key = String(turnIndex)
  const next: DeliveryByTurn = {
    ...current,
    [key]: { ...current[key], ...patch },
  }
  const res = await airtableRequest(`${CONVERSATIONS_TABLE}/${existing.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { [FIELD.delivery]: JSON.stringify(next) },
    }),
  })
  if (!res.ok) {
    throw new Error(
      `Airtable delivery update failed: ${res.status} ${await res.text()}`
    )
  }
}

export function isConversationsTableConfigured(): boolean {
  return Boolean(TOKEN && BASE && CONVERSATIONS_TABLE)
}
