import {
  isConversationsTableConfigured,
  recordCitationClick,
} from '@/lib/admin/airtable'

export interface AssistantTurnEvent {
  kind: 'turn'
  query: string
  currentPage: string
  responseChars: number
  citations: number
  zeroMatches: boolean
  latencyMs: number
}

export interface AssistantClickEvent {
  kind: 'click'
  /** What was clicked: a listing card (default), or an inline markdown link
   *  in the reply prose (e.g. a "Jobs" link to /jobs). */
  target?: 'card' | 'link'
  /** The listing id, for card clicks. Absent for link clicks. */
  citationId?: string
  /** Which assistant turn the clicked card or link sat in (its index in the
   *  stored conversation history). Lets the admin badge the one instance the
   *  visitor actually clicked instead of every copy of that listing or href
   *  across the chat. Absent for older clients that didn't send it. */
  turnIndex?: number
  /** Destination: the card's url, or the inline link's href. */
  url: string
  /** The link's visible text, for link clicks (shown in the admin viewer). */
  label?: string
  currentPage: string
  /** Conversation this click belongs to, so it can be recorded on the row. */
  sessionId?: string | null
}

export interface AssistantOpenEvent {
  kind: 'open'
  trigger: 'pill' | 'chip' | 'keyboard'
  currentPage: string
}

export interface AssistantSuggestEvent {
  kind: 'suggest'
  query: string
  /** The suggest form's type ('community', 'correction', …). Absent when the
   *  token carried no recognized type (the generic listing form). */
  type?: string
  /** Which assistant turn offered the button (its index in the stored
   *  conversation history), so the admin badges the one instance the visitor
   *  pressed. Absent for older clients that didn't send it. */
  turnIndex?: number
  currentPage: string
  /** Conversation this press belongs to, so it can be recorded on the row. */
  sessionId?: string | null
}

export type AssistantEvent =
  | AssistantTurnEvent
  | AssistantClickEvent
  | AssistantOpenEvent
  | AssistantSuggestEvent

export async function logAssistantEvent(event: AssistantEvent): Promise<void> {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...event,
  })
  console.log(`[assistant] ${line}`)

  // Persist clicks onto the conversation row so the admin viewer can show what
  // the visitor actually opened. Cards are keyed `<turnIndex>:<listing id>`,
  // inline links `<turnIndex>:link:<href>` and suggest-form buttons
  // `<turnIndex>:suggest:<type>`, so the exact instance is known (the same
  // listing or href can appear in several replies; without the turn scope one
  // click badged every copy). The `link:`/`suggest:` prefixes never collide
  // with a `type:recXXX` id. Older clients omit turnIndex — fall back to the
  // unscoped key, which the admin still matches (badging every copy) for
  // legacy rows.
  if (
    (event.kind === 'click' || event.kind === 'suggest') &&
    event.sessionId &&
    isConversationsTableConfigured()
  ) {
    const clickKey =
      event.kind === 'suggest'
        ? event.turnIndex != null
          ? `${event.turnIndex}:suggest:${event.type ?? 'listing'}`
          : `suggest:${event.type ?? 'listing'}`
        : event.target === 'link'
          ? event.turnIndex != null
            ? `${event.turnIndex}:link:${event.url}`
            : `link:${event.url}`
          : event.citationId != null && event.turnIndex != null
            ? `${event.turnIndex}:${event.citationId}`
            : event.citationId
    try {
      if (clickKey) await recordCitationClick(event.sessionId, clickKey)
    } catch (err) {
      console.warn(
        `[assistant] click persist failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  const sinkUrl = process.env.ASSISTANT_LOG_WEBHOOK
  if (!sinkUrl) return
  try {
    await fetch(sinkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: line,
    })
  } catch (err) {
    console.warn(
      `[assistant] log webhook failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
