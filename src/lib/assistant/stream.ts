// Shared streaming + tool-use loop for the assistant. Both the public
// /api/assistant route and the admin /api/admin/test-run route call into
// runAssistantStream so the protocol stays in lockstep.

import Anthropic from '@anthropic-ai/sdk'
import { auditCardCitations, extractCitations } from './citations'
import { modelDisplayName } from './models'
import { TOOL_DEFINITIONS, executeTool } from './tools'
import type { Catalog, ChatMessage, CitationRef, Listing } from './types'

// Generous so multi-card responses never truncate mid-token. Anthropic
// requires this parameter, so it can't be "unlimited" — pick a value well
// above any realistic response size.
const MAX_TOKENS = 4096
const MAX_HISTORY = 14
const MAX_TOOL_ITERATIONS = 10
// Hard server-side budget matching the prompt's "at most 5 page reads per
// turn" rule — each read is a multi-second external fetch, so a runaway model
// must not be able to chain 10 of them.
const MAX_PAGE_READS_PER_TURN = 5

export type SseSend = (event: string, data: unknown) => void

/** Encodes a single SSE frame. */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

interface GenerateContext {
  send: SseSend
  /** Aborted if the client disconnects mid-stream. Pass into Anthropic SDK
   *  calls so token generation stops as soon as no one is listening. */
  signal: AbortSignal
}

/** Wraps an async generator function in a streaming SSE Response. The
 *  generator receives `send(event, data)` and an AbortSignal that fires when
 *  the client disconnects. Errors thrown from the generator are emitted as
 *  an `error` SSE event before the stream closes. */
export function sseResponse(
  generate: (ctx: GenerateContext) => Promise<void>
): Response {
  const encoder = new TextEncoder()
  const ac = new AbortController()
  const stream = new ReadableStream({
    async start(controller) {
      const send: SseSend = (event, data) => {
        if (ac.signal.aborted) return
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)))
        } catch {
          // Controller was closed (e.g. client disconnected mid-frame).
        }
      }
      try {
        await generate({ send, signal: ac.signal })
      } catch (err) {
        if (ac.signal.aborted) return
        const message = err instanceof Error ? err.message : 'unknown error'
        console.error('[assistant] stream error:', message)
        send('error', { message })
      } finally {
        try {
          controller.close()
        } catch {
          // Already closed.
        }
      }
    },
    cancel() {
      ac.abort()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}

/** Validates and normalises the incoming messages array. Throws on bad input
 *  so the route can return a 400 with a useful message. */
export function validateMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) throw new Error('messages must be an array')
  const out: ChatMessage[] = []
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue
    const msg = m as { role?: unknown; content?: unknown }
    if (msg.role !== 'user' && msg.role !== 'assistant') continue
    if (typeof msg.content !== 'string') continue
    if (msg.content.length === 0 || msg.content.length > 4000) continue
    out.push({ role: msg.role, content: msg.content })
  }
  if (out.length === 0) throw new Error('no valid messages')
  if (out[out.length - 1].role !== 'user') {
    throw new Error('last message must be from user')
  }
  return out.slice(-MAX_HISTORY)
}

/** Builds the Anthropic message list, prepending the context line to the
 *  final user turn so the model sees it as ambient setup. */
export function buildApiMessages(
  messages: ChatMessage[],
  contextLine: string
): Anthropic.MessageParam[] {
  return messages.map((m, idx) => {
    if (idx === messages.length - 1 && m.role === 'user') {
      return { role: m.role, content: `${contextLine}\n\n${m.content}` }
    }
    return { role: m.role, content: m.content }
  })
}

interface ToolCallLogEntry {
  name: string
  input: unknown
  ok: boolean
}

export interface AssistantRunResult {
  assistantText: string
  toolCalls: ToolCallLogEntry[]
  citations: CitationRef[]
}

interface RunOptions {
  client: Anthropic
  systemPrompt: string
  pagesBlock: string
  donationGuide: string
  model: string
  apiMessages: Anthropic.MessageParam[]
  catalog: Catalog
  send: SseSend
  /** Cancels the in-flight Anthropic call when the client disconnects. */
  signal?: AbortSignal
}

/** Runs the assistant tool-use loop, streaming text deltas and tool events
 *  via `send`, and returns the final assistant text + citations once the
 *  model stops with a non-tool reason or hits MAX_TOOL_ITERATIONS. */
export async function runAssistantStream(
  opts: RunOptions
): Promise<AssistantRunResult> {
  const {
    client,
    systemPrompt,
    pagesBlock,
    donationGuide,
    model,
    apiMessages,
    catalog,
    send,
    signal,
  } = opts
  let assistantText = ''
  const cited: Listing[] = []
  const toolCalls: ToolCallLogEntry[] = []

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    if (signal?.aborted) return { assistantText, toolCalls, citations: [] }
    const response = await client.messages.create(
      {
        model,
        max_tokens: MAX_TOKENS,
        system: [
          { type: 'text', text: systemPrompt },
          { type: 'text', text: pagesBlock },
          { type: 'text', text: donationGuide },
          {
            type: 'text',
            text: `You are currently running on ${modelDisplayName(model)}. If a user asks what model powers you, this is the answer.`,
            // Cache the whole static prefix (tools + all system blocks). The
            // prefix is byte-identical across the up-to-10 tool-use iterations
            // in a turn and across conversation turns, so after the first
            // write each request reads it at ~0.1x cost. 5-minute TTL (the
            // default) comfortably covers both. Render order is
            // tools -> system -> messages, so this one breakpoint on the last
            // system block caches the tool definitions too.
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: TOOL_DEFINITIONS,
        messages: apiMessages,
        stream: true,
      },
      { signal }
    )

    // Reconstruct the assistant turn so we can append it to apiMessages and
    // feed tool results back in the next iteration.
    const blocks: Anthropic.ContentBlockParam[] = []
    let currentTextBlock = ''
    let currentToolUse: { id: string; name: string; inputJson: string } | null =
      null
    let stopReason: string | null = null

    for await (const event of response) {
      if (event.type === 'message_start') {
        // One-line cache-stats log per API call so we can confirm prompt
        // caching is working in the Vercel logs. `cache_read_input_tokens > 0`
        // means the static tools+system prefix was served from cache.
        const u = event.message.usage
        console.log(
          `[assistant] cache iter=${iter} read=${u.cache_read_input_tokens ?? 0} write=${u.cache_creation_input_tokens ?? 0} input=${u.input_tokens}`
        )
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          currentTextBlock = ''
        } else if (event.content_block.type === 'tool_use') {
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            inputJson: '',
          }
          send('tool_call_start', {
            id: event.content_block.id,
            name: event.content_block.name,
          })
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          currentTextBlock += event.delta.text
          assistantText += event.delta.text
          send('text', { delta: event.delta.text })
        } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.inputJson += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          let parsedInput: Record<string, unknown> = {}
          try {
            parsedInput = currentToolUse.inputJson
              ? JSON.parse(currentToolUse.inputJson)
              : {}
          } catch (err) {
            console.warn(
              `[assistant] tool ${currentToolUse.name} sent malformed JSON, treating input as empty`,
              err
            )
          }
          blocks.push({
            type: 'tool_use',
            id: currentToolUse.id,
            name: currentToolUse.name,
            input: parsedInput,
          })
          currentToolUse = null
        } else if (currentTextBlock) {
          blocks.push({ type: 'text', text: currentTextBlock })
          currentTextBlock = ''
        }
      } else if (event.type === 'message_delta') {
        if (event.delta.stop_reason) stopReason = event.delta.stop_reason
      }
    }

    apiMessages.push({ role: 'assistant', content: blocks })
    if (stopReason !== 'tool_use') break

    const toolUseBlocks = blocks.filter(
      (b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use'
    )
    if (toolUseBlocks.length === 0) break

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUseBlocks) {
      const overReadBudget =
        tu.name === 'read_listing_page' &&
        toolCalls.filter(c => c.name === 'read_listing_page').length >=
          MAX_PAGE_READS_PER_TURN
      const result = overReadBudget
        ? {
            ok: false,
            content:
              'Page-read budget for this turn is used up. Answer from what you already have — do not request another page read.',
            listings: [],
          }
        : await executeTool(tu.name, tu.input as unknown, catalog)
      toolCalls.push({ name: tu.name, input: tu.input, ok: result.ok })
      cited.push(...result.listings)
      const n = result.listings.length
      const summary =
        tu.name === 'search_listings'
          ? `${n} match${n === 1 ? '' : 'es'}`
          : tu.name === 'get_listing'
            ? result.ok
              ? 'fetched'
              : 'not found'
            : tu.name === 'read_listing_page'
              ? result.ok
                ? 'read'
                : 'unreadable'
              : 'done'
      send('tool_call_done', {
        id: tu.id,
        name: tu.name,
        ok: result.ok,
        summary,
        input: tu.input,
        listings: result.listings.map(toCitationRef),
      })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result.content,
        is_error: !result.ok,
      })
    }
    apiMessages.push({ role: 'user', content: toolResults })
  }

  // Citations come from the listings the model actually used (via tools).
  // If it also wrote bare [[id:...]] markers, fold those in too.
  const byId = new Map<string, CitationRef>()
  for (const l of cited) byId.set(l.id, toCitationRef(l))
  for (const c of extractCitations(assistantText, catalog)) byId.set(c.id, c)

  // Audit the [[card:...]] ids the model wrote. A card naming a REAL listing it
  // never tool-surfaced is backfilled so the stored snapshot carries it; a card
  // naming NOTHING in the catalog is fabricated — log it (the live renderer
  // shows a "Browse X" link, the admin flags it UNRESOLVED) rather than letting
  // the invention pass silently.
  const { backfill, fabricated } = auditCardCitations(
    assistantText,
    Array.from(byId.values()),
    catalog
  )
  for (const ref of backfill) byId.set(ref.id, ref)
  if (fabricated.length > 0) {
    console.warn(
      `[assistant] fabricated card id(s) with no matching listing: ${fabricated.join(', ')}`
    )
  }

  // Telemetry: a turn that finishes with no user-facing answer (truly empty, or
  // only a reasoning trail before [[/thinking]]) leaves the visitor with a blank
  // reply. Log it so we can measure how often it happens instead of letting it
  // pass silently. The client surfaces a retry prompt for the same condition.
  const answer = assistantText.split(/\[\[\s*\/\s*thinking\s*\]\]/i).pop() ?? ''
  if (!answer.trim()) {
    console.warn(
      `[assistant] blank answer — no user-facing text produced (chars=${assistantText.length}, toolCalls=${toolCalls.length})`
    )
  }

  return { assistantText, toolCalls, citations: Array.from(byId.values()) }
}

function toCitationRef(l: Listing): CitationRef {
  return {
    id: l.id,
    type: l.type,
    name: l.name,
    organization: l.organization,
    logo: l.logo,
    url: l.url,
    pageUrl: l.pageUrl,
    description: l.description,
    meta: l.meta,
  }
}
