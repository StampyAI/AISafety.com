/*
  Server-side ActiveCampaign I/O for the newsletter approval page
  (/admin/newsletter).

  The weekly pipeline on Bryce's Mac (~/Newsletter/issue.py) turns a Pen draft
  into an ActiveCampaign DRAFT campaign whose message carries a hidden content
  marker: `<!--aisafety-issue:<checksum>-->`. This module is the other half:
  it lists those drafts, re-checks them exactly the way the pipeline's
  `ac.py verify` does, and on approval schedules the send.

  Guardrails mirrored from ac.py (see ~/Newsletter/PLAN.md "Two verified traps"):
  - the campaign must still be a draft, wired to exactly ONE list (per-list
    one-click unsubscribe depends on it), with one message;
  - the message's marker must be present and match a fresh checksum of its
    HTML — a missing marker means someone saved the email in AC's visual
    designer (which silently wipes code-injected HTML); a mismatch means the
    content changed outside the pipeline. Either way: refuse to send.

  Sending: AC's v1 API has no "send now" for an existing draft, so approval
  creates the sending campaign from the verified message (status 1, sdate a
  couple of minutes out, in the account's local time) and deletes the draft
  shell. Reads use the v3 API; the two writes use v1, the only API that can
  schedule a send (unlocked on the paid plan, 30 Aug 2026).
*/

import { createHash } from 'node:crypto'

const MARKER_RE = /<!--aisafety-issue:([0-9a-f]{16})-->/
/** Minutes between approval and the send. AC rejects sdates in the past and
 *  runs its scheduler about once a minute, so two is the practical minimum. */
const SEND_DELAY_MINUTES = 2
/** Used for the account's local time when AC's own timestamps can't be read
 *  (account set up from Colombia, 2026). */
const FALLBACK_UTC_OFFSET = '-05:00'
/** Replaces %SENDER-INFO-SINGLELINE% in previews; AC fills the real one. */
const SENDER_INFO =
  'AISafety.com, 2810 N Church St PMB 49028, Wilmington, DE 19802-4447, US'

export function isNewsletterConfigured(): boolean {
  return Boolean(
    process.env.ACTIVECAMPAIGN_URL && process.env.ACTIVECAMPAIGN_KEY
  )
}

function base(): string {
  return (process.env.ACTIVECAMPAIGN_URL ?? '').replace(/\/+$/, '')
}

function apiKey(): string {
  return process.env.ACTIVECAMPAIGN_KEY ?? ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function v3<T = any>(path: string): Promise<T> {
  const res = await fetch(`${base()}/api/3/${path}`, {
    headers: { 'Api-Token': apiKey() },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(
      `ActiveCampaign ${path.split('?')[0]}: ${res.status} ${await res.text()}`
    )
  }
  return res.json() as Promise<T>
}

async function v1(
  action: string,
  fields: Record<string, string | number>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({
    api_action: action,
    api_output: 'json',
    api_key: apiKey(),
  })
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) body.set(k, String(v))
  const res = await fetch(`${base()}/admin/api.php?${qs}`, {
    method: 'POST',
    body,
    cache: 'no-store',
  })
  const out = (await res.json()) as Record<string, unknown>
  if (Number(out.result_code) !== 1) {
    throw new Error(
      `ActiveCampaign ${action} failed: ${String(out.result_message)}`
    )
  }
  return out
}

/** Checksum of the message content, ignoring the marker itself. Identical to
 *  ac.py `content_digest()`: AC decodes `&amp;` one level and appends a
 *  trailing newline when it stores HTML, so both are canonicalised away —
 *  anything else still changes the digest. */
export function contentDigest(html: string): string {
  let s = html.replace(MARKER_RE, '')
  while (s.includes('&amp;')) s = s.replace(/&amp;/g, '&')
  s = s.replace(/\s+$/, '')
  return createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)
}

interface RawCampaign {
  id: string
  name: string
  status: string
  cdate: string | null
  sdate: string | null
  ldate: string | null
  send_amt: string | null
  uniqueopens?: string | null
  unsubscribes?: string | null
}

interface RawMessage {
  id: string
  subject: string
  fromemail: string
  fromname: string
  html: string | null
}

export interface DraftSummary {
  id: string
  name: string
  subject: string
  fromEmail: string
  fromName: string
  createdAt: string | null
  messageId: string | null
  listId: string | null
  listName: string | null
  /** Active contacts on the list right now (who would receive the send). */
  activeContacts: number | null
  /** Empty when the draft passes every check and may be sent. */
  problems: string[]
}

export interface SentSummary {
  id: string
  name: string
  status: 'scheduled' | 'sending' | 'sent' | 'stopped' | 'paused'
  scheduledFor: string | null
  sentAt: string | null
  sentTo: number
  uniqueOpens: number | null
  unsubscribes: number | null
  listNames: string[]
}

const STATUS_NAMES: Record<string, SentSummary['status']> = {
  '1': 'scheduled',
  '2': 'sending',
  '3': 'paused',
  '4': 'stopped',
  '5': 'sent',
}

async function campaignListIds(campaignId: string): Promise<string[]> {
  const data = await v3<{ campaignLists: Array<{ list: string }> }>(
    `campaigns/${campaignId}/campaignLists`
  )
  return (data.campaignLists ?? []).map(l => String(l.list))
}

async function campaignMessageIds(campaignId: string): Promise<string[]> {
  const data = await v3<{ campaignMessages: Array<{ messageid: string }> }>(
    `campaigns/${campaignId}/campaignMessages`
  )
  return (data.campaignMessages ?? []).map(m => String(m.messageid))
}

async function message(messageId: string): Promise<RawMessage> {
  const data = await v3<{ message: RawMessage }>(`messages/${messageId}`)
  return data.message
}

async function listNames(): Promise<Map<string, string>> {
  const data = await v3<{ lists: Array<{ id: string; name: string }> }>(
    'lists?limit=100'
  )
  return new Map((data.lists ?? []).map(l => [String(l.id), l.name]))
}

/** Active contacts on a list — the number an approved send goes to. */
async function activeContactCount(listId: string): Promise<number | null> {
  try {
    const data = await v3<{ meta?: { total?: string | number } }>(
      `contacts?listid=${encodeURIComponent(listId)}&status=1&limit=1`
    )
    const total = data.meta?.total
    return total == null ? null : Number(total)
  } catch {
    return null
  }
}

async function allCampaigns(): Promise<RawCampaign[]> {
  const data = await v3<{ campaigns: RawCampaign[] }>(
    'campaigns?limit=100&orders[cdate]=DESC'
  )
  return data.campaigns ?? []
}

/** The checks `ac.py verify` runs, as a list of problems (empty = OK). */
async function checkDraft(
  campaign: RawCampaign,
  expectedListId: string | null
): Promise<{
  problems: string[]
  listIds: string[]
  messageId: string | null
  msg: RawMessage | null
}> {
  const problems: string[] = []
  if (campaign.status !== '0') {
    problems.push(
      `campaign status is ${STATUS_NAMES[campaign.status] ?? campaign.status}, expected draft`
    )
  }
  const listIds = await campaignListIds(campaign.id)
  if (listIds.length !== 1) {
    problems.push(
      `campaign is wired to ${listIds.length} lists, expected exactly one`
    )
  } else if (expectedListId != null && listIds[0] !== expectedListId) {
    problems.push(
      `campaign is wired to list ${listIds[0]}, expected ${expectedListId}`
    )
  }
  const messageIds = await campaignMessageIds(campaign.id)
  let msg: RawMessage | null = null
  if (messageIds.length !== 1) {
    problems.push(
      `campaign has ${messageIds.length} messages, expected exactly one`
    )
  } else {
    msg = await message(messageIds[0])
    const html = msg.html ?? ''
    const m = MARKER_RE.exec(html)
    if (!m) {
      problems.push(
        'content marker missing — the email was probably saved in the ActiveCampaign designer, which wipes pipeline content; rebuild the issue'
      )
    } else if (m[1] !== contentDigest(html)) {
      problems.push(
        'checksum mismatch — the content was changed outside the pipeline; rebuild the issue'
      )
    }
  }
  return { problems, listIds, messageId: messageIds[0] ?? null, msg }
}

/** Pipeline drafts waiting for approval: draft campaigns whose message carries
 *  the content marker. Hand-made drafts in AC never show here. */
export async function listDrafts(): Promise<DraftSummary[]> {
  const campaigns = await allCampaigns()
  const names = await listNames()
  const out: DraftSummary[] = []
  for (const c of campaigns) {
    if (c.status !== '0') continue
    const messageIds = await campaignMessageIds(c.id)
    if (messageIds.length === 0) continue
    const msg = await message(messageIds[0])
    if (!MARKER_RE.test(msg.html ?? '')) continue
    const { problems, listIds } = await checkDraft(c, null)
    const listId = listIds.length === 1 ? listIds[0] : null
    out.push({
      id: c.id,
      name: c.name,
      subject: msg.subject,
      fromEmail: msg.fromemail,
      fromName: msg.fromname,
      createdAt: c.cdate,
      messageId: msg.id,
      listId,
      listName: listId ? (names.get(listId) ?? null) : null,
      activeContacts: listId ? await activeContactCount(listId) : null,
      problems,
    })
  }
  return out
}

/** The most recent sends (and anything scheduled or stuck), newest first. */
export async function listRecent(limit = 12): Promise<SentSummary[]> {
  const campaigns = await allCampaigns()
  const names = await listNames()
  const recent = campaigns
    .filter(c => c.status in STATUS_NAMES)
    .sort((a, b) =>
      String(b.ldate ?? b.sdate ?? '').localeCompare(
        String(a.ldate ?? a.sdate ?? '')
      )
    )
    .slice(0, limit)
  const out: SentSummary[] = []
  for (const c of recent) {
    const listIds = await campaignListIds(c.id)
    out.push({
      id: c.id,
      name: c.name,
      status: STATUS_NAMES[c.status],
      scheduledFor: c.sdate,
      sentAt: c.ldate,
      sentTo: Number(c.send_amt ?? 0),
      uniqueOpens: c.uniqueopens == null ? null : Number(c.uniqueopens),
      unsubscribes: c.unsubscribes == null ? null : Number(c.unsubscribes),
      listNames: listIds.map(id => names.get(id) ?? `list ${id}`),
    })
  }
  return out
}

/** The message HTML as a subscriber will see it, with AC's personalisation
 *  tags neutralised so the preview renders cleanly. */
export async function previewHtml(campaignId: string): Promise<string | null> {
  const messageIds = await campaignMessageIds(campaignId)
  if (messageIds.length !== 1) return null
  const msg = await message(messageIds[0])
  const html = msg.html ?? ''
  if (!MARKER_RE.test(html)) return null
  return html
    .replace(MARKER_RE, '')
    .replace(/%UNSUBSCRIBELINK%/g, '#')
    .replace(/%WEBCOPY%/g, '#')
    .replace(/%SENDER-INFO-SINGLELINE%/g, SENDER_INFO)
}

/** AC stores sdate in the account's local time. Read the current UTC offset
 *  from a timestamp AC itself returns, so DST can never shift a send. */
async function accountUtcOffset(): Promise<string> {
  const campaigns = await allCampaigns()
  for (const c of campaigns) {
    const m = /([+-]\d{2}:\d{2})$/.exec(c.cdate ?? '')
    if (m) return m[1]
  }
  return FALLBACK_UTC_OFFSET
}

/** `YYYY-MM-DD HH:MM:SS` for `at`, expressed in the given UTC offset. */
export function formatLocal(at: Date, offset: string): string {
  const sign = offset.startsWith('-') ? -1 : 1
  const minutes =
    sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)))
  const shifted = new Date(at.getTime() + minutes * 60_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ` +
    `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}`
  )
}

export class DraftProblemError extends Error {
  problems: string[]
  constructor(problems: string[]) {
    super(`draft failed verification: ${problems.join('; ')}`)
    this.problems = problems
  }
}

export interface ScheduledSend {
  /** The new, sending campaign (the draft shell is deleted). */
  campaignId: string
  draftId: string
  sdate: string | null
  listName: string | null
  activeContacts: number | null
}

/** Verify the draft one last time, then schedule it to send in a couple of
 *  minutes. Refuses (DraftProblemError) on any verification problem. */
export async function approveAndSend(
  draftId: string,
  listId: string
): Promise<ScheduledSend> {
  const campaigns = await allCampaigns()
  const draft = campaigns.find(c => c.id === draftId)
  if (!draft) throw new DraftProblemError(['draft campaign not found'])
  const { problems, messageId } = await checkDraft(draft, listId)
  if (problems.length > 0 || !messageId) {
    throw new DraftProblemError(
      problems.length > 0 ? problems : ['no message on the draft']
    )
  }
  const offset = await accountUtcOffset()
  const sdate = formatLocal(
    new Date(Date.now() + SEND_DELAY_MINUTES * 60_000),
    offset
  )
  const created = await v1('campaign_create', {
    type: 'single',
    name: draft.name,
    status: 1,
    public: 0,
    tracklinks: 'all',
    sdate,
    [`p[${listId}]`]: listId,
    [`m[${messageId}]`]: 100,
  })
  const newId = String(created.id)
  const live = (await v3<{ campaign: RawCampaign }>(`campaigns/${newId}`))
    .campaign
  if (live.status !== '1' && live.status !== '2') {
    throw new Error(
      `scheduled campaign ${newId} has status ${STATUS_NAMES[live.status] ?? live.status} — check the ActiveCampaign dashboard`
    )
  }
  // The message now belongs to the sending campaign; the draft shell is noise.
  await v1('campaign_delete', { id: draftId })
  const names = await listNames()
  console.info(
    `[newsletter] draft ${draftId} approved → campaign ${newId} scheduled for ${live.sdate ?? sdate} on list ${listId}`
  )
  return {
    campaignId: newId,
    draftId,
    sdate: live.sdate ?? sdate,
    listName: names.get(listId) ?? null,
    activeContacts: await activeContactCount(listId),
  }
}
