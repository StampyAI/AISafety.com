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
  currentPage: string
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
  // the visitor actually opened. Cards are keyed by listing id; inline links by
  // a `link:`-prefixed href, which never collides with a `type:recXXX` id.
  if (
    event.kind === 'click' &&
    event.sessionId &&
    isConversationsTableConfigured()
  ) {
    const clickKey =
      event.target === 'link' ? `link:${event.url}` : event.citationId
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
