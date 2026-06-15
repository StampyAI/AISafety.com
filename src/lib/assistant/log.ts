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
  citationId: string
  url: string
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

  // Persist card clicks onto the conversation row so the admin viewer can
  // show which cards the visitor actually opened.
  if (
    event.kind === 'click' &&
    event.sessionId &&
    isConversationsTableConfigured()
  ) {
    try {
      await recordCitationClick(event.sessionId, event.citationId)
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
