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
