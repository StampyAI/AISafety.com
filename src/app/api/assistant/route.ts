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
  type AssistantRunResult,
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
  const headerCity = req.headers.get('x-vercel-ip-city')
  const region = req.headers.get('x-vercel-ip-country-region')
  const country = req.headers.get('x-vercel-ip-country')
  // Prefer Vercel's edge geo, but fill any field it omits from the client
  // fallback (ipapi). Vercel often returns region + country but no city; without
  // this merge the city from the fallback was discarded and the admin row fell
  // back to the bare region code (e.g. "ENG").
  const merged = {
    city: headerCity ? decodeURIComponent(headerCity) : (fallback?.city ?? undefined),
    region: region ?? fallback?.region ?? undefined,
    country: country ?? fallback?.country ?? undefined,
  }
  if (merged.city || merged.region || merged.country) return merged
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
    // Persist a turn to the conversation log. Called on success AND on
    // failure: even when the model returned nothing — the visitor closed the
    // tab before the first token, or generation errored — the question they
    // typed is still useful signal. It shows what people asked when the bot
    // failed them, so we keep it instead of dropping the whole turn. `status`
    // marks the no-reply turns so the admin viewer can flag them: 'abandoned'
    // (visitor left before/without an answer) or 'error' (generation failed).
    const logTurn = (
      result: AssistantRunResult | null,
      status?: 'abandoned' | 'error'
    ) => {
      const assistantText = result?.assistantText ?? ''
      const toolCalls = result?.toolCalls ?? []
      const citations = result?.citations ?? []
      const zeroMatches =
        citations.length === 0 && /\[\[suggest:/.test(assistantText)

      // Snapshot name/url ONLY for listings actually carded in the reply (a
      // handful), not every searched listing – citations can be the whole
      // result set (e.g. 400+ jobs), which would blow past Airtable's cell
      // limit. The viewer only needs refs for [[card:...]] ids anyway.
      const citedById = new Map(citations.map(c => [c.id, c]))
      const cardedIds = new Set<string>()
      const cardRe = /\[\[\s*card\s*:\s*([^\]|\n]+?)(?:\s*\|[^\]\n]*)?\s*\]\]/gi
      let cardMatch: RegExpExecArray | null
      while ((cardMatch = cardRe.exec(assistantText)) !== null) {
        cardedIds.add(cardMatch[1].replace(/\s+/g, ''))
      }
      const citationRefs = [...cardedIds]
        .map(id => citedById.get(id))
        .filter((c): c is (typeof citations)[number] => Boolean(c))
        .map(c => ({ id: c.id, name: c.name, url: c.url, logo: c.logo }))

      // after() keeps the serverless function alive until the write completes.
      // A bare fire-and-forget promise gets frozen (and usually lost) the
      // moment the response stream closes, so conversations were never
      // reaching Airtable in production.
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
          // Full conversation including the assistant's just-finished reply
          // (empty when generation produced nothing), so the upsert persists
          // the up-to-date History in one row.
          history: [...messages, { role: 'assistant', content: assistantText }],
          toolCalls,
          response: assistantText,
          citations: citations.map(c => c.id),
          citationRefs,
          zeroMatches,
          status,
          latencyMs: Date.now() - startedAt,
          promptVersion: PROMPT_VERSION,
        })
      )
    }

    let result: AssistantRunResult
    try {
      result = await runAssistantStream({
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
    } catch (err) {
      // Generation threw (API/model error, or the stream aborted mid-flight).
      // This turn used to vanish entirely; still log the visitor's query so we
      // can see what was asked, then re-throw so sseResponse emits the error
      // event (or handles the abort) exactly as before. A client disconnect is
      // an abandonment, not a bug, so flag it accordingly.
      logTurn(null, signal.aborted ? 'abandoned' : 'error')
      throw err
    }
    send('done', {})
    // Log every completed turn — including ones where the visitor left before
    // the first token streamed (empty reply), which we used to drop. An empty
    // completion means nothing streamed, so flag it as abandoned.
    const empty = !result.assistantText && result.toolCalls.length === 0
    logTurn(result, empty ? 'abandoned' : undefined)
  })
}
