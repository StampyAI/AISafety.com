import { NextRequest, after } from 'next/server'
import { logAssistantEvent } from '@/lib/assistant/log'
import type { AssistantEvent } from '@/lib/assistant/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isValidEvent(value: unknown): value is AssistantEvent {
  if (!value || typeof value !== 'object') return false
  const v = value as { kind?: unknown }
  if (v.kind === 'click' || v.kind === 'open' || v.kind === 'suggest')
    return true
  return false
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }
  if (!isValidEvent(body)) {
    return new Response('invalid event', { status: 400 })
  }
  // after() keeps the function alive until the (now Airtable-writing) log
  // call finishes; a bare fire-and-forget promise gets frozen once the 204
  // returns, which would drop click writes in production.
  after(() => logAssistantEvent(body))
  return new Response(null, { status: 204 })
}
