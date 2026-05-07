/*
  Airtable schema for the admin conversation log.

  ─── assistant_conversations ───
  ID env var: ADMIN_CONVERSATIONS_TABLE_ID
  One row per CONVERSATION (keyed by Session). Each turn updates the row
  in place: refresh the latest fields, extend Data.history, accumulate
  Data.tools/citations.

  Fields:
    Session         (single line text)  — natural key
    Page            (single line text)  — page of the latest turn
    Latency ms      (number)            — latest turn's latency
    Prompt version  (single line text)  — latest, e.g. "2026-05-07-1"
    Notes           (long text)         — admin annotations
    Tags            (multi-select)      — admin annotations
    Created at      (created time)      — auto, first-turn timestamp
    Data            (long text)         — JSON payload, see ConversationData
                                          below for shape

  Prompt drafts are NOT persisted to Airtable. They live in browser
  localStorage in the admin editor. Production prompts ship via code.
*/

const TOKEN = process.env.AIRTABLE_TOKEN
const BASE = process.env.AIRTABLE_BASE_ID
const CONVERSATIONS_TABLE = process.env.ADMIN_CONVERSATIONS_TABLE_ID

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

/** Shape of the JSON stored in the `Data` column. */
export interface ConversationData {
  user: string
  response: string
  history: HistoryTurn[]
  tools: unknown[]
  citations: string[]
  geo: { city?: string; region?: string; country?: string } | null
  referrer: string | null
  utm: Record<string, string> | null
  pageState: Record<string, unknown> | null
  zeroMatches: boolean
}

interface ConversationFields {
  Session?: string
  Page?: string
  'Latency ms'?: number
  'Prompt version'?: string
  Notes?: string
  Tags?: string[]
  Data?: string
}

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
}

const EMPTY_DATA: ConversationData = {
  user: '',
  response: '',
  history: [],
  tools: [],
  citations: [],
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

function rowToConversation(
  row: AirtableRow<ConversationFields>
): ConversationRow {
  return {
    id: row.id,
    createdAt: row.createdTime,
    session: row.fields.Session ?? '',
    page: row.fields.Page ?? '',
    latencyMs: row.fields['Latency ms'] ?? null,
    promptVersion: row.fields['Prompt version'] ?? '',
    notes: row.fields.Notes ?? '',
    tags: row.fields.Tags ?? [],
    data: parseData(row.fields.Data),
  }
}

export async function listConversations(
  opts: {
    limit?: number
  } = {}
): Promise<ConversationRow[]> {
  ensureConfig(CONVERSATIONS_TABLE)
  const params = new URLSearchParams()
  params.set('pageSize', String(Math.min(opts.limit ?? 50, 100)))
  params.set('sort[0][field]', 'Created at')
  params.set('sort[0][direction]', 'desc')
  const rows = await listAll<ConversationFields>(CONVERSATIONS_TABLE, params)
  return rows.slice(0, opts.limit ?? 50).map(rowToConversation)
}

export async function updateConversation(
  id: string,
  patch: { notes?: string; tags?: string[] }
): Promise<ConversationRow> {
  ensureConfig(CONVERSATIONS_TABLE)
  const fields: ConversationFields = {}
  if (patch.notes !== undefined) fields.Notes = patch.notes
  if (patch.tags !== undefined) fields.Tags = patch.tags
  const res = await airtableRequest(`${CONVERSATIONS_TABLE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
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
  params.set('filterByFormula', `{Session} = "${escaped}"`)
  params.set('maxRecords', '1')
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
  session: string | null
  page: string
  user: string
  response: string
  history: HistoryTurn[]
  tools: unknown
  citations: string[]
  geo: ConversationData['geo']
  referrer: string | null
  utm: Record<string, string> | null
  pageState: Record<string, unknown> | null
  latencyMs: number
  zeroMatches: boolean
  promptVersion: string
}): Promise<void> {
  ensureConfig(CONVERSATIONS_TABLE)

  // Without a session id we can't dedupe across turns; just create a new row.
  const existing = input.session
    ? await findConversationBySession(input.session)
    : null
  const previous = existing ? parseData(existing.fields.Data) : null

  const data: ConversationData = {
    user: input.user,
    response: input.response,
    history: input.history,
    tools: previous ? [...previous.tools, input.tools] : [input.tools],
    citations: previous
      ? Array.from(new Set([...previous.citations, ...input.citations]))
      : input.citations,
    geo: input.geo,
    referrer: input.referrer,
    utm: input.utm,
    pageState: input.pageState,
    // Sticky once any turn returned no matches.
    zeroMatches: (previous?.zeroMatches ?? false) || input.zeroMatches,
  }

  const fields: ConversationFields = {
    Session: input.session ?? '',
    Page: input.page,
    'Latency ms': input.latencyMs,
    'Prompt version': input.promptVersion,
    Data: JSON.stringify(data),
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

export function isConversationsTableConfigured(): boolean {
  return Boolean(TOKEN && BASE && CONVERSATIONS_TABLE)
}
