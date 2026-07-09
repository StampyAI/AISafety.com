// Persists complete conversation turns. Console + optional Airtable table
// (ADMIN_CONVERSATIONS_TABLE_ID) + optional webhook. Use this for product
// analytics: what people asked, what they got, what failed.

import {
  isConversationsTableConfigured,
  upsertConversation,
} from '@/lib/admin/airtable'

export interface StoredTurn {
  ts: string
  sessionId: string | null
  currentPage: string
  pageState: Record<string, unknown> | null
  referrer: string | null
  geo: { city?: string; region?: string; country?: string } | null
  utm: Record<string, string> | null
  user: string
  history: { role: 'user' | 'assistant'; content: string }[]
  toolCalls: { name: string; input: unknown; ok: boolean }[]
  response: string
  /** Card ids in this turn's reply that rendered as a generic "Browse X"
   *  fallback link (or nothing) instead of a real card in the visitor's chat. */
  fallbackCards: string[]
  citations: string[]
  citationRefs: { id: string; name: string; url: string; logo?: string }[]
  zeroMatches: boolean
  /** Set when the turn produced no usable reply: 'abandoned' (visitor left
   *  before/without an answer) or 'error' (generation failed). Absent on
   *  normal turns. */
  status?: 'abandoned' | 'error'
  latencyMs: number
  promptVersion: string
}

export async function storeConversationTurn(turn: StoredTurn): Promise<void> {
  const summary = {
    session: turn.sessionId,
    page: turn.currentPage,
    user: turn.user.slice(0, 80),
    citations: turn.citations.length,
    tools: turn.toolCalls.map(t => t.name),
    zero: turn.zeroMatches,
    status: turn.status,
    ms: turn.latencyMs,
  }
  console.log(`[assistant:turn] ${JSON.stringify(summary)}`)

  if (isConversationsTableConfigured()) {
    try {
      await upsertConversation({
        session: turn.sessionId,
        page: turn.currentPage,
        user: turn.user,
        response: turn.response,
        history: turn.history,
        tools: turn.toolCalls,
        fallbackCards: turn.fallbackCards,
        citations: turn.citations,
        citationRefs: turn.citationRefs,
        geo: turn.geo,
        referrer: turn.referrer,
        utm: turn.utm,
        pageState: turn.pageState,
        latencyMs: turn.latencyMs,
        zeroMatches: turn.zeroMatches,
        status: turn.status,
        promptVersion: turn.promptVersion,
      })
    } catch (err) {
      console.warn(
        `[assistant] airtable log failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  const webhook = process.env.ASSISTANT_CONVERSATION_WEBHOOK
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(turn),
      })
    } catch (err) {
      console.warn(
        `[assistant] webhook failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
}
