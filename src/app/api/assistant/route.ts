import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, after } from 'next/server'
import { getCatalog } from '@/lib/assistant/catalog'
import {
  PRODUCTION_PROMPT,
  PROMPT_VERSION,
  PAGES_BLOCK,
  buildContextLine,
  type RequestContext,
} from '@/lib/assistant/prompt'
import { DEFAULT_MODEL_ID } from '@/lib/assistant/models'
import {
  buildApiMessages,
  runAssistantStream,
  sseResponse,
  validateMessages,
} from '@/lib/assistant/stream'
import { storeConversationTurn } from '@/lib/assistant/conversation-store'
import { getDonationGuideText } from '@/lib/assistant/donation-guide'
import {
  checkAssistantRateLimit,
  getClientIp,
} from '@/lib/assistant/rate-limit'
import type { AssistantRequest, ChatMessage } from '@/lib/assistant/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function readGeo(
  req: NextRequest,
  fallback: AssistantRequest['geoFallback']
): RequestContext['geo'] {
  const city = req.headers.get('x-vercel-ip-city')
  const region = req.headers.get('x-vercel-ip-country-region')
  const country = req.headers.get('x-vercel-ip-country')
  if (city || region || country) {
    return {
      city: city ? decodeURIComponent(city) : undefined,
      region: region ?? undefined,
      country: country ?? undefined,
    }
  }
  if (fallback && (fallback.city || fallback.region || fallback.country)) {
    return {
      city: fallback.city ?? undefined,
      region: fallback.region ?? undefined,
      country: fallback.country ?? undefined,
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const ip = getClientIp(req.headers)
  const limit = await checkAssistantRateLimit(ip)
  if (!limit.ok) {
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: "You've hit today's message limit. Try again tomorrow.",
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(limit.retryAfterSeconds),
        },
      }
    )
  }

  let body: AssistantRequest
  try {
    body = (await req.json()) as AssistantRequest
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let messages: ChatMessage[]
  try {
    messages = validateMessages(body.messages)
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'invalid messages',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const catalog = await getCatalog()
  const ctx: RequestContext = {
    currentPage: typeof body.currentPage === 'string' ? body.currentPage : '/',
    pageState: body.pageState ?? null,
    referrer: body.referrer ?? null,
    geo: readGeo(req, body.geoFallback),
    utm: body.utm ?? null,
  }
  const apiMessages = buildApiMessages(messages, buildContextLine(ctx))
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userQuery = messages[messages.length - 1].content
  const startedAt = Date.now()

  return sseResponse(async ({ send, signal }) => {
    const result = await runAssistantStream({
      client,
      systemPrompt: PRODUCTION_PROMPT,
      pagesBlock: PAGES_BLOCK,
      donationGuide: getDonationGuideText(),
      model: DEFAULT_MODEL_ID,
      apiMessages,
      catalog,
      send,
      signal,
    })
    send('done', {})
    if (signal.aborted) return

    const zeroMatches =
      result.citations.length === 0 && /\[\[suggest:/.test(result.assistantText)
    // after() keeps the serverless function alive until the write completes.
    // A bare fire-and-forget promise gets frozen (and usually lost) the moment
    // the response stream closes, so conversations were never reaching
    // Airtable in production.
    after(() =>
      storeConversationTurn({
        ts: new Date().toISOString(),
        sessionId: body.sessionId ?? null,
        currentPage: ctx.currentPage,
        pageState: ctx.pageState ?? null,
        referrer: ctx.referrer ?? null,
        geo: ctx.geo ?? null,
        utm: ctx.utm ?? null,
        user: userQuery,
        // Full conversation including the assistant's just-completed reply,
        // so the upsert can persist the up-to-date History in one row.
        history: [
          ...messages,
          { role: 'assistant', content: result.assistantText },
        ],
        toolCalls: result.toolCalls,
        response: result.assistantText,
        citations: result.citations.map(c => c.id),
        zeroMatches,
        latencyMs: Date.now() - startedAt,
        promptVersion: PROMPT_VERSION,
      })
    )
  })
}
