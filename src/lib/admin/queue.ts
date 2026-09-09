/*
  The Queue: one Airtable table ("Queue", tblonlKwIFJ7Aa8QN) holding every
  proposed change or addition to the directory that is waiting for the owner.
  Rows are written by the bots on Bryce's Mac (Comb's Fable Review, Broom's
  Fable Review, the Secretary, the Discord intake); this file is the site's
  side — list the rows, and carry out a decision:

    accept  Add     → tick Publish? on the target record (plus any edits)
            Change  → write the proposed field values, drop the Broom flag row
            Rule    → mark Accepted; the Mac worker patches the rulebook
    reject          → mark Rejected with the reason (the worker deletes a
                      rejected suggestion 24 hours later, so there is an undo)
    revise          → mark Revising with a note; the worker asks Claude to
                      rewrite the proposal and puts it back as Pending
    undo            → reverse an accept or reject made in the last day

  Writes to the resource tables go through the raw admin client (no cache);
  after a publish or a field change the public cache tag is revalidated so
  the live pages pick it up within a few minutes. Field ids for the Queue
  table are permanent; target-record fields are addressed by NAME because
  the proposals name them and "Publish?"/"Hide?" are the same on every
  resource table.
*/

import { revalidateTag } from 'next/cache'
import { airtableRequest, isRecordId, listAll } from './airtable'

export const QUEUE_TABLE_ID = 'tblonlKwIFJ7Aa8QN'
const BROOM_ISSUES_TABLE_ID = 'tblntD3WITPEgjHRK'

const F = {
  title: 'fldeRsOE3DM3R2vbX',
  type: 'fldBc9YIDhjmu58f3',
  source: 'flddKkVy62MAZ8M0J',
  status: 'fldTXGYOoXcUApaI2',
  page: 'fldAMyLjM8CnXSRPX',
  targetTable: 'fld45SUjstUZROuXl',
  targetRecord: 'fldszXtLdUijgFG4l',
  issueRow: 'fld5zaEwhergaWYbF',
  sourceLink: 'fld4jnmGibDfKUwNx',
  sourceExcerpt: 'fld9VtbNjLpodrtA7',
  proposal: 'fldgl9Ny2jnu8T0Da',
  verdict: 'fld835yJytaSRAuvB',
  reasons: 'fldvEp4bscGNzBcSJ',
  rejectChips: 'fldw42wRz08vO5Xzq',
  replyDraft: 'fld8lCAVyjDEVZ8VV',
  replyStatus: 'fldQuPHr742txLFCo',
  rejectReason: 'fldYa0cnc5rQxAfAa',
  note: 'fldaV8eBHNEuNPIjp',
  edits: 'fldzCgKQbopgcbrwq',
  decidedAt: 'fldtt7z4lYvAR5t94',
  appliedAt: 'fldML8YnyaDYaAmTb',
  error: 'fldrJcvFN3FCcyQPn',
  dedupKey: 'fldHuxapq09JkiohE',
} as const

export type QueueType = 'Add' | 'Change' | 'Rule'
export type QueueSource =
  | 'Email'
  | 'Discord'
  | 'Broom'
  | 'Comb'
  | 'Form'
  | 'Teach'
export type QueueStatus =
  | 'Pending'
  | 'Revising'
  | 'Accepted'
  | 'Applied'
  | 'Rejected'
  | 'Failed'
  | 'Closed'
export type Verdict = 'Publish' | "Don't publish" | 'Unsure' | 'Fix' | 'Dismiss'

export interface ProposedChange {
  field: string
  from: unknown
  to: unknown
}

export interface QueueItem {
  id: string
  createdAt: string
  title: string
  type: QueueType
  source: QueueSource
  status: QueueStatus
  page: string | null
  targetTable: string | null
  targetRecord: string | null
  issueRow: string | null
  sourceLink: string | null
  sourceExcerpt: string | null
  /** Add: the proposed record, field name → value. */
  fields: Record<string, unknown> | null
  name: string | null
  url: string | null
  /** Change: the proposed field edits. */
  changes: ProposedChange[]
  /** Rule: the proposed rulebook diff. */
  diff: string | null
  verdict: Verdict | null
  reasons: string[]
  rejectChips: string[]
  replyDraft: string | null
  replyStatus: string | null
  rejectReason: string | null
  note: string | null
  edits: Record<string, unknown> | null
  decidedAt: string | null
  appliedAt: string | null
  error: string | null
}

type RawFields = Record<string, unknown>

/** Thrown for a problem the page should show as-is (bad input, already
 *  decided, Airtable refused). `status` is the HTTP status to answer with. */
export class QueueError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const TABLE_ID_RE = /^tbl[A-Za-z0-9]{14}$/

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function lines(v: unknown): string[] {
  return typeof v === 'string'
    ? v
        .split('\n')
        .map(l => l.replace(/^[-–•*]\s*/, '').trim())
        .filter(Boolean)
    : []
}

function parseJson(v: unknown): unknown {
  if (typeof v !== 'string' || v.trim() === '') return null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function toChanges(v: unknown): ProposedChange[] {
  if (!Array.isArray(v)) return []
  const out: ProposedChange[] = []
  for (const c of v) {
    if (!isRecord(c)) continue
    const field = str(c.field)
    if (!field) continue
    out.push({ field, from: c.from ?? null, to: c.to ?? null })
  }
  return out
}

function rowToItem(row: {
  id: string
  createdTime: string
  fields: RawFields
}): QueueItem {
  const f = row.fields
  const proposal = parseJson(f[F.proposal])
  let fields: Record<string, unknown> | null = null
  let name: string | null = null
  let url: string | null = null
  let changes: ProposedChange[] = []
  let diff: string | null = null
  if (isRecord(proposal)) {
    changes = toChanges(proposal.changes)
    diff = str(proposal.diff)
    name = str(proposal.name)
    url = str(proposal.url)
    if (isRecord(proposal.fields)) {
      fields = proposal.fields
    } else if (changes.length === 0 && !diff) {
      const rest: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(proposal)) {
        if (k !== 'name' && k !== 'url') rest[k] = v
      }
      fields = rest
    }
  }
  const edits = parseJson(f[F.edits])
  return {
    id: row.id,
    createdAt: row.createdTime,
    title: str(f[F.title]) ?? name ?? '(untitled)',
    type: (str(f[F.type]) as QueueType | null) ?? 'Add',
    source: (str(f[F.source]) as QueueSource | null) ?? 'Comb',
    status: (str(f[F.status]) as QueueStatus | null) ?? 'Pending',
    page: str(f[F.page]),
    targetTable: str(f[F.targetTable]),
    targetRecord: str(f[F.targetRecord]),
    issueRow: str(f[F.issueRow]),
    sourceLink: str(f[F.sourceLink]),
    sourceExcerpt: str(f[F.sourceExcerpt]),
    fields,
    name,
    url,
    changes,
    diff,
    verdict: str(f[F.verdict]) as Verdict | null,
    reasons: lines(f[F.reasons]),
    rejectChips: lines(f[F.rejectChips]),
    replyDraft: str(f[F.replyDraft]),
    replyStatus: str(f[F.replyStatus]),
    rejectReason: str(f[F.rejectReason]),
    note: str(f[F.note]),
    edits: isRecord(edits) ? edits : null,
    decidedAt: str(f[F.decidedAt]),
    appliedAt: str(f[F.appliedAt]),
    error: str(f[F.error]),
  }
}

// Open rows, plus anything decided in the last day (the "Done today" strip
// with its Undo buttons).
const LIST_FORMULA =
  "OR({Status}='Pending',{Status}='Revising',{Status}='Accepted',{Status}='Failed'," +
  "AND(OR({Status}='Applied',{Status}='Rejected'),IS_AFTER({Decided at},DATEADD(NOW(),-1,'day'))))"

export async function listQueue(): Promise<QueueItem[]> {
  const params = new URLSearchParams()
  params.set('returnFieldsByFieldId', 'true')
  params.set('filterByFormula', LIST_FORMULA)
  const rows = await listAll<RawFields>(QUEUE_TABLE_ID, params)
  return rows.map(rowToItem)
}

/** Count for the tab badge. Never throws: a badge is not worth an error page. */
export async function pendingQueueCount(): Promise<number> {
  try {
    const params = new URLSearchParams()
    params.set('filterByFormula', "{Status}='Pending'")
    params.append('fields[]', 'Status')
    return (await listAll<RawFields>(QUEUE_TABLE_ID, params)).length
  } catch {
    return 0
  }
}

export async function getQueueItem(id: string): Promise<QueueItem | null> {
  if (!isRecordId(id)) return null
  const res = await airtableRequest(
    `${QUEUE_TABLE_ID}/${id}?returnFieldsByFieldId=true`
  )
  if (res.status === 404 || res.status === 403) return null
  if (!res.ok) {
    throw new QueueError(
      `Airtable read failed: ${res.status} ${await res.text()}`,
      502
    )
  }
  return rowToItem(
    (await res.json()) as { id: string; createdTime: string; fields: RawFields }
  )
}

// ─── Airtable helpers ───────────────────────────────────────────────────────

async function patchRecord(
  table: string,
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await airtableRequest(`${table}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new QueueError(
      res.status === 429
        ? 'Airtable is rate-limiting right now. Try again in a few seconds.'
        : `Airtable refused the change: ${res.status} ${text.slice(0, 300)}`,
      502
    )
  }
}

/** True when the record exists (in this base). */
async function recordExists(table: string, id: string): Promise<boolean> {
  // The single-record endpoint takes no fields[] filter; the row is small.
  const res = await airtableRequest(`${table}/${id}`)
  if (res.status === 404 || res.status === 403) return false
  if (!res.ok) {
    throw new QueueError(
      `Airtable read failed: ${res.status} ${await res.text()}`,
      502
    )
  }
  return true
}

/** Deletes a record; a record that is already gone is not an error. */
async function deleteRecord(table: string, id: string): Promise<void> {
  const res = await airtableRequest(`${table}/${id}`, { method: 'DELETE' })
  if (res.ok || res.status === 404 || res.status === 403) return
  throw new QueueError(
    `Airtable refused the delete: ${res.status} ${await res.text()}`,
    502
  )
}

async function patchQueueRow(
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  await patchRecord(QUEUE_TABLE_ID, id, fields)
}

function target(item: QueueItem): { table: string; record: string } {
  const table = item.targetTable ?? ''
  const record = item.targetRecord ?? ''
  if (!TABLE_ID_RE.test(table) || !isRecordId(record)) {
    throw new QueueError('This item has no valid target record.', 400)
  }
  return { table, record }
}

const PROTECTED_FIELDS = new Set(['Publish?', 'Hide?'])

/** Field name → value pairs the admin typed, checked before they reach
 *  Airtable: names must be plain short strings and never the publish flags. */
export function sanitiseEdits(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    const name = k.trim()
    if (!name || name.length > 100 || PROTECTED_FIELDS.has(name)) continue
    if (
      v === null ||
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      (Array.isArray(v) && v.every(x => typeof x === 'string'))
    ) {
      out[name] = v === '' ? null : v
    }
  }
  return out
}

function now(): string {
  return new Date().toISOString()
}

function refreshCache(): void {
  revalidateTag('airtable-records', 'max')
}

function requireOpen(item: QueueItem): void {
  if (item.status !== 'Pending' && item.status !== 'Failed') {
    throw new QueueError(
      `This item is already ${item.status.toLowerCase()}. Reload the page.`,
      409
    )
  }
}

// ─── Decisions ──────────────────────────────────────────────────────────────

export async function acceptItem(
  item: QueueItem,
  edits: Record<string, unknown>
): Promise<void> {
  requireOpen(item)
  const stamp = now()
  const editsJson = Object.keys(edits).length ? JSON.stringify(edits) : null
  try {
    if (item.type === 'Add') {
      const t = target(item)
      await patchRecord(t.table, t.record, { ...edits, 'Publish?': true })
    } else if (item.type === 'Change') {
      const t = target(item)
      const fields: Record<string, unknown> = {}
      for (const c of item.changes) {
        if (PROTECTED_FIELDS.has(c.field) || c.field.length > 100) continue
        fields[c.field] = c.field in edits ? edits[c.field] : c.to
      }
      if (Object.keys(fields).length === 0) {
        throw new QueueError('This item proposes no field changes.', 400)
      }
      await patchRecord(t.table, t.record, fields)
      if (item.issueRow && isRecordId(item.issueRow)) {
        await deleteRecord(BROOM_ISSUES_TABLE_ID, item.issueRow)
      }
    } else {
      // Rule: the file lives on the Mac; the worker applies it.
      await patchQueueRow(item.id, {
        [F.status]: 'Accepted',
        [F.decidedAt]: stamp,
        [F.error]: null,
      })
      return
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await patchQueueRow(item.id, {
      [F.status]: 'Failed',
      [F.error]: msg.slice(0, 1000),
    }).catch(() => {})
    throw e
  }
  await patchQueueRow(item.id, {
    [F.status]: 'Applied',
    [F.decidedAt]: stamp,
    [F.appliedAt]: stamp,
    [F.edits]: editsJson,
    [F.error]: null,
  })
  refreshCache()
}

export async function rejectItem(
  item: QueueItem,
  reason: string
): Promise<void> {
  requireOpen(item)
  const why = reason.trim()
  if (!why && item.type !== 'Rule') {
    throw new QueueError('A reason is needed so the bots can learn from it.')
  }
  const stamp = now()
  const fields: Record<string, unknown> = {
    [F.status]: 'Rejected',
    [F.rejectReason]: why || null,
    [F.decidedAt]: stamp,
    [F.error]: null,
  }
  if (item.type === 'Change' && item.issueRow && isRecordId(item.issueRow)) {
    // A dismissed Broom flag is done with: clear the flag row now.
    await deleteRecord(BROOM_ISSUES_TABLE_ID, item.issueRow)
    fields[F.appliedAt] = stamp
  }
  await patchQueueRow(item.id, fields)
}

export async function reviseItem(item: QueueItem, note: string): Promise<void> {
  requireOpen(item)
  const text = note.trim()
  if (!text) throw new QueueError('Say what should change.')
  await patchQueueRow(item.id, {
    [F.status]: 'Revising',
    [F.note]: text.slice(0, 2000),
    [F.error]: null,
  })
}

export async function undoItem(item: QueueItem): Promise<void> {
  const reopen: Record<string, unknown> = {
    [F.status]: 'Pending',
    [F.decidedAt]: null,
    [F.appliedAt]: null,
    [F.rejectReason]: null,
    [F.error]: null,
  }
  if (item.status === 'Applied' && item.type === 'Add') {
    const t = target(item)
    await patchRecord(t.table, t.record, { 'Publish?': false })
    await patchQueueRow(item.id, reopen)
    refreshCache()
    return
  }
  if (item.status === 'Applied' && item.type === 'Change') {
    const t = target(item)
    const fields: Record<string, unknown> = {}
    for (const c of item.changes) {
      if (PROTECTED_FIELDS.has(c.field)) continue
      fields[c.field] = c.from ?? null
    }
    if (Object.keys(fields).length) await patchRecord(t.table, t.record, fields)
    await patchQueueRow(item.id, reopen)
    refreshCache()
    return
  }
  if (item.status === 'Rejected') {
    if (item.type === 'Add') {
      const t = target(item)
      if (!(await recordExists(t.table, t.record))) {
        throw new QueueError(
          'Too late: the record has already been deleted.',
          409
        )
      }
    }
    await patchQueueRow(item.id, reopen)
    return
  }
  if (item.status === 'Accepted' && item.type === 'Rule') {
    await patchQueueRow(item.id, reopen)
    return
  }
  throw new QueueError(
    `Nothing to undo: the item is ${item.status.toLowerCase()}.`,
    409
  )
}
