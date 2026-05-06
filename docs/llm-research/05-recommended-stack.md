# 05 — Recommended stack

The previous docs settle the *shape* of the system: a tool-using
chat ([03 §A3](./03-architecture-options.md)) on a dedicated
`/ask` page ([04 §U2](./04-ui-integration.md)). This doc commits
to concrete picks — model, embeddings, vector store, runtime,
SDK, libraries — and explains why each one is the path of least
resistance given what's already in the repo.

A v1 implementation should not need anything outside this list.

## TL;DR — the picks

| Concern              | Pick                                            | Why (one-liner)                                                                                          |
| -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Chat model           | `claude-sonnet-4-6` (primary), `haiku-4-5` (fallback) | Best instruction-following + tool use at the price point; Haiku for cost-sensitive routes / dev.   |
| Embedding model      | `voyage-3-lite` (1024-d) or `text-embedding-3-small` (1536-d) | Both cheap; Voyage edges out on retrieval quality at this scale.                            |
| Vector store         | Upstash Vector (REST, edge-compatible)          | Free tier covers our ~1k corpus; HTTP API works in Edge runtime; no new infra dashboard.                 |
| Runtime              | Vercel Edge (Next.js route handler)             | Streaming-first, low first-token latency; same project as site.                                          |
| SDK / orchestration  | Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)      | Native Next.js streaming, tool-use loop handled, React `useChat` ready.                                  |
| Rate limit           | Upstash Redis + `@upstash/ratelimit`            | Same vendor as vector store; sliding-window limiter is a 5-line setup.                                   |
| Logs / evals         | Vercel logs (default) + manual eval set         | No tracing vendor in v1; revisit if quality issues need offline replay.                                  |
| Index build location | Inside `next build`                             | Slots into the existing `check-rebuild → deploy` pipeline; no new cron.                                  |

The rest of the doc walks each pick.

## 1. Chat model

### 1a. Why Claude Sonnet 4.6 as primary

Three things matter for this assistant:

1. **Tool use reliability.** The whole architecture rests on the
   model deciding to call `search_listings` rather than free-styling.
   Claude Sonnet 4.x has been the most reliable tool-caller across
   the published comparisons since Sonnet 4 — it rarely fabricates
   tool args, rarely skips required tools, and degrades gracefully
   when results are sparse.
2. **Refusal of conceptual hand-offs.** The system prompt has to
   make Claude redirect "what is RLHF?" to `aisafety.info` rather
   than answer from training data. Claude is more obedient about
   "don't answer outside scope" instructions than the GPT family
   in our experience — fewer overrides needed.
3. **Streaming + Vercel AI SDK support.** First-class streaming
   in `@ai-sdk/anthropic`; tool-call streaming is well-tested.

### 1b. Why Haiku 4.5 as fallback / for development

`haiku-4-5` is roughly an order of magnitude cheaper than Sonnet
on output tokens. For:

- **Local development** of the prompt and tools, where each turn
  costs near-zero and the volume is high.
- **A "cheap mode" route** if the bill on Sonnet ever becomes a
  problem — Haiku is more than capable for the donation-guide walk
  and for routing ("which page covers X?") where there's a single
  obvious answer. We'd keep Sonnet for the open-ended recommendation
  use case.

### 1c. Why not GPT-4 / Gemini / open-weights

- **GPT-4 / GPT-4o**: Equivalent quality, slightly worse
  instruction-following on "stay in scope" in our experience, and
  introduces a second vendor relationship. Worth keeping as a
  drop-in alternative — `@ai-sdk/openai` works identically — but
  not the default.
- **Gemini 2.5**: Long context is appealing for the
  prompted-only fallback (option A1), but tool-use ergonomics in
  the Vercel AI SDK are less mature.
- **Open-weights (Llama, Mistral)**: Self-hosting is out of scope
  for v1 (see [03 §B3](./03-architecture-options.md#b3--self-hosted)).
  Inference via Together / Groq is viable but adds vendor risk
  for marginal cost savings on a low-volume site.

### 1d. Model parameters

```ts
{
  model: 'claude-sonnet-4-6',
  temperature: 0.2,            // factual recommender; some variance is fine
  maxTokens: 1024,             // ~750 words; matches the "150-word default" target
  system: SYSTEM_PROMPT,       // see §6
  tools: [searchListings, walkDonationGuide, getPageSummary],
  toolChoice: 'auto',
}
```

`temperature` should not be 0 — at 0 the model becomes more
prone to repeating the same hand-off phrasing turn after turn,
which feels robotic. `0.2` is the floor that still keeps
recommendations stable across rephrasings.

## 2. Embeddings

### 2a. Why Voyage `voyage-3-lite`

- **Quality**: outperforms `text-embedding-3-small` on retrieval
  benchmarks (MTEB, BEIR) at similar cost — particularly on
  domain-specific corpora, which ours is.
- **Cost**: roughly $0.02 per 1M tokens at 1024-d. For our corpus
  (~500k tokens of corpus content, single-digit thousands of query
  tokens per day), this is sub-dollar per month including the
  weekly re-embed.
- **Dimensionality**: 1024-d is a sweet spot — small enough that
  Upstash Vector indexing is fast, large enough that semantic
  resolution is good.

### 2b. Acceptable alternative: OpenAI `text-embedding-3-small`

If we'd rather avoid a third vendor (we're already on
Anthropic + Vercel + Airtable + Upstash), `text-embedding-3-small`
at 1536-d works fine — slightly lower retrieval quality, same
order of magnitude cost. The choice doesn't materially change
the architecture; both are HTTP REST APIs callable from Edge.

### 2c. What we are *not* doing

- **No fine-tuned domain embeddings**. Our corpus is too small
  (~1k docs) for fine-tuning to outperform a strong general
  embedder. We'd be over-fitting to lexical quirks of a hundred
  job titles.
- **No multi-vector / late-interaction (ColBERT) retrieval**.
  Diminishing returns for short documents and query-time cost we
  don't need.

### 2d. What we embed

The `text` field defined in [01 §2a](./01-content-inventory.md#2a-one-document-per-airtable-record-plus-the-page-level-prose):
a human-readable serialisation of the structured fields plus the
description, ordered the way someone would describe the listing
aloud.

> *"AI Alignment Slack — Online community on Slack. Focus:
> technical AI safety, alignment research. Activity: very active.
> Size: 5,000+ members."*

We do **not** embed JSON of the record — embeddings on JSON
lose semantic signal compared to natural-language renderings.

## 3. Vector store

### 3a. Why Upstash Vector

- **Edge-compatible REST API.** No client library, no connection
  pooling, no `pgvector` SDK that doesn't run on Vercel Edge.
  POST a query, get JSON back.
- **Free tier covers us.** 200MB / 10k vector limit; we'd use
  a few MB and ~1k vectors. Paid tier starts at $0.40 per 100k
  queries, which we won't hit either.
- **Single-region by default**, with global option. Single is
  fine — the latency floor is dominated by the LLM call, not the
  vector lookup.
- **Built-in metadata filtering** — supports the "filter by
  `type=job`, then rank by similarity" pattern from
  [03 §A3](./03-architecture-options.md#4-option-a3--hybrid-structured-query--vector-reranker)
  natively, without needing a separate Postgres + pgvector
  set up.

### 3b. Acceptable alternative: Vercel Postgres + pgvector

If we ever already had Postgres in the stack (e.g. for analytics
or chat history), pgvector would be the natural pick — one fewer
vendor. Right now we don't have a database, so spinning one up
just for retrieval is heavier than Upstash Vector.

### 3c. What we are *not* doing

- **No Pinecone / Weaviate / Qdrant Cloud / Turbopuffer.** All
  fine products, all overkill at our scale. The decisive factor is
  vendor surface area: every dashboard is one more thing for the
  team to babysit.
- **No bake-the-embeddings-into-the-build.** We considered shipping
  `embeddings.json` with the build and doing cosine in JS at
  query time. It's tempting (zero infra) but loses metadata
  filtering, makes the prompt-side code grow, and breaks the
  moment we add a second corpus (e.g. AISafety.info content). Not
  worth the saved latency.

### 3d. Schema

Each Upstash Vector record is `(id, vector, metadata)`:

```jsonc
{
  "id": "airtable:communities:recXXXXXXXXXXXXXX",
  "vector": [0.012, -0.041, …],   // 1024 floats from voyage-3-lite
  "metadata": {
    "page": "/communities",
    "type": "community",
    "title": "AI Alignment Slack",
    "description": "Online community on Slack…",
    "platform": ["Slack"],
    "activityLevel": "Very active",
    "location": null,
    "remote": true,
    "url": "https://join.slack.com/…",
    "logo": "/images/airtable-cache/att…png",
    "lastUpdated": "2026-04-12T12:34:56Z",
    "status": "active"
  }
}
```

The whole listing fits in metadata so the chat can render a card
without a follow-up DB hit. This costs us a bit of Upstash storage
quota (negligible at our size) and saves a round trip. The
embedding *source text* is not stored as-is on the vector; it's
re-derivable from the metadata at index-rebuild time.

## 4. Runtime

### 4a. Why Vercel Edge

Settled in [03 §B1](./03-architecture-options.md#b1--vercel-edge-function).
The relevant constraint check for stack-level decisions:

- **Streaming**: `@ai-sdk/anthropic` ships an Edge build; works
  with web streams, no Node-only deps.
- **Upstash Vector**: HTTP REST, no SDK with native bindings.
- **Voyage embeddings**: HTTP REST, edge-compatible.
- **Anthropic SDK**: edge-compatible.
- **Airtable**: not needed at chat time. Indexing happens at
  build, where Node runtime is fine.

So nothing in the chat-serving path requires Node. Edge is clean.

### 4b. Function path & exports

```ts
// src/app/api/chat/route.ts
export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export async function POST(req: Request) { /* … */ }
```

Mirroring `src/app/api/check-rebuild/route.ts` (Node + dynamic)
but on Edge. Naming convention is consistent with Next.js
conventions and the existing code.

### 4c. Cold starts

Edge cold starts are sub-100ms in practice. Node cold starts on
Vercel can be 500ms–2s for chat routes (depending on bundle size).
First-token UX is dominated by the model, not the runtime, but
500ms+ of dead time before any tokens stream is noticeable. Edge
wins this comfortably.

## 5. SDK / orchestration

### 5a. Why Vercel AI SDK (`ai` package)

- **Tool-use loop handled.** The "model emits tool_use → server
  runs tool → result back into prompt → model continues" loop is
  one `streamText({ tools })` call; we don't roll our own.
- **`useChat()` React hook.** Streaming UI, message state,
  pending state, error handling — all out of the box. Saves a
  ~200-line component.
- **Provider-agnostic.** If we swap Sonnet for GPT-4o, it's a
  one-line `model:` change. Future-proof.
- **Edge-friendly.** SDK is published as Edge-compatible.

### 5b. Versions to pin

`ai` is on a major-version bump cadence; pin to a specific
`^5.x` once you implement, since `useChat()` API has shifted
between majors. Same for `@ai-sdk/anthropic`.

```jsonc
{
  "dependencies": {
    "ai": "^5.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@upstash/vector": "^1.2.0",
    "@upstash/ratelimit": "^2.0.0",
    "@upstash/redis": "^1.34.0",
    "voyageai": "^0.0.4"
    // existing deps unchanged
  }
}
```

(Versions are illustrative; bump to current at implementation
time. The point is the *set* of additions, not the exact pins.)

### 5c. Tool definitions

Three tools, mirroring [03 §A3](./03-architecture-options.md#4-option-a3--hybrid-structured-query--vector-reranker):

```ts
import { tool } from 'ai'
import { z } from 'zod'

const searchListings = tool({
  description:
    'Search the AISafety.com directory for listings matching the user\'s ' +
    'criteria. Use when the user wants concrete recommendations (jobs, ' +
    'communities, courses, funders, advisors, projects, channels, ' +
    'founder tools, orgs from the field map).',
  inputSchema: z.object({
    type: z.enum([
      'job', 'community', 'funder', 'course', 'advisor',
      'project', 'channel', 'founder-tool', 'org', 'event',
    ]).optional(),
    location: z.string().optional()
      .describe('Free-text location, e.g. "London", "remote".'),
    experience: z.enum(['junior', 'mid', 'senior']).optional(),
    remote: z.boolean().optional(),
    query: z.string()
      .describe('Free-text semantic match, the user\'s actual phrasing.'),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  execute: searchListingsImpl,  // hits Upstash with metadata filter
})

const walkDonationGuide = tool({
  description:
    'Look up the matching cell from the /donation-guide decision tree. ' +
    'Use when the user asks where to donate and gives an amount and a ' +
    'time budget (or you can infer them).',
  inputSchema: z.object({
    amount: z.enum(['$1-1k', '$1k-10k', '$10k-100k', '$100k+']),
    time:   z.enum(['5min-1h', '1-50h', 'ongoing', 'major']),
  }),
  execute: walkDonationGuideImpl,
})

const getPageSummary = tool({
  description:
    'Get a short summary of one of AISafety.com\'s resource pages. Use ' +
    'when the user asks "where on this site is X?" or "what does this ' +
    'site have on Y?".',
  inputSchema: z.object({
    path: z.enum([
      '/map', '/communities', '/funding', '/jobs', '/self-study',
      '/advisors', '/projects', '/media-channels', '/founders',
      '/donation-guide', '/about', '/events-and-training',
    ]),
  }),
  execute: getPageSummaryImpl,
})
```

Three is the right number: more, and the model gets confused
about which to call; fewer, and we lose the "structured query"
property of [03 §A3](./03-architecture-options.md#4-option-a3--hybrid-structured-query--vector-reranker).

## 6. System prompt skeleton

The system prompt is where we encode the use-case rules from
[02](./02-use-cases.md). Sketch (final wording lives in code):

```
You are the AISafety.com assistant. You help visitors navigate
AISafety.com's directory of AI-safety opportunities, organisations,
and resources. AISafety.com is a curated directory; it does not
publish articles or research.

ROLE
- Recommend listings from AISafety.com's directory using the tools.
- Walk visitors through the donation guide.
- Route visitors to the right page on AISafety.com.

CONSTRAINTS
- For conceptual AI-safety questions ("what is RLHF?", "why is
  alignment hard?"), do not answer. Redirect the user to
  https://aisafety.info, which is structured for that.
- Never name a specific organisation, fund, course, job, or
  community unless it appears in a tool result. The tools are
  your only source of truth about the directory.
- Every concrete recommendation must include a link.
- Keep answers under ~150 words and ≤5 listings unless asked.
- Do not write cover letters, applications, funding pitches, or
  other content on the user's behalf.
- When you have nothing relevant from tool results, say so
  honestly and link to https://aisafety.com/<page> or the
  "Suggest a listing" form.

STYLE
- Plain markdown. No headings within a single response unless
  the answer truly has multiple sections.
- One follow-up question at the end of non-trivial responses,
  framed as a question (not a multiple-choice list).
- Prefer site-internal links (`/communities`, `/jobs`) over
  external when routing; external when citing a specific
  listing.
```

This prompt is short on purpose. Long system prompts are a
common failure mode — the model loses the plot in the middle
sections. Each rule above maps to a row in the
[02 §5 eval rubric](./02-use-cases.md#5-behaviour-checklist-for-evals);
if a rule isn't in the rubric, it shouldn't be in the prompt.

## 7. Index build pipeline

### 7a. Where it runs

Inside `next build`, in a postbuild step. The build already
fetches Airtable for static-page generation, so the data is
in-process; we don't want to fetch Airtable twice.

The flow:

```
next build
  └── (existing) page generators call src/lib/data/* loaders
       which fetch from Airtable
  └── (new) src/scripts/build-index.ts
       1. Re-call the same loaders to get current records
          (already cached in the build, near-zero cost).
       2. For each record, build the embedding text
          (the human-readable serialisation from 01 §2a).
       3. Diff against the last-indexed manifest stored in
          Upstash Vector metadata (lastUpdated timestamps).
       4. Re-embed only changed records via Voyage.
       5. Upsert vectors into Upstash.
       6. Delete vectors whose record id no longer appears in
          the loaders' output (dropped or unpublished records).
       7. Run the donation-guide cell extractor on the
          /donation-guide source file (see 7c).
       8. Run page-summary generation for the hand-written
          pages (homepage, /about, /events-and-training).
```

Failure here should fail the build, not silently ship a stale
index — `CLAUDE.md` calls this out explicitly under "Never
Silently Fail".

### 7b. Avoiding two source-of-truth files

The donation-guide page text lives in
`src/app/donation-guide/page.tsx` as JSX (~1,000 lines, content
in tabs `tab1`–`tab4`). Two ways to keep the corpus in sync:

- **Extract at build time** by parsing the page module — fragile,
  AST-based, breaks on every refactor.
- **Move the text into a typed data file** (e.g.
  `src/data/donation-guide.ts`) that the page component renders
  *and* the indexer reads. One source of truth.

The second is what we want. It's a small refactor of the
existing page (~1 hour) and produces a much cleaner indexer.

### 7c. Page summaries

`/about`, the homepage navigation copy, and the resource-page
intros (one per directory page) get a single ~100-word summary
each, hand-written and committed to
`src/data/page-summaries.ts`. The indexer turns each into a
document of `type: page`. These are the documents that answer
"where on the site is X?" routing queries.

There are ~12 of these and they change rarely. Keeping them in
the repo (not Airtable) gives us version control and review on
the assistant's most user-visible answers.

### 7d. Build-time cost

Per-deploy cost (rough order of magnitude):

- Voyage embeddings: ~1k records × 200 tokens avg = 200k tokens
  at $0.02/1M = **$0.004 per full re-embed**, sub-millisecond.
- Upstash Vector upserts: free tier covers 10k ops/day.
- Net build-time delta: <30s on a cold rebuild, <5s on an
  incremental rebuild.

In practice we'd cache the embeddings between builds (manifest
keyed on record `id` + `lastUpdated`) so a typical deploy only
re-embeds the handful of records that changed.

## 8. Rate limit & abuse mitigation

### 8a. Upstash Redis + `@upstash/ratelimit`

Same vendor as the vector store. Sliding window, IP-keyed:

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '1h'),
  analytics: true,
})
```

30 messages/IP/hour is comfortable for genuine use, throttles
abuse. Easy to tighten later.

### 8b. Other safeguards (low cost, high value)

- **Max input length**: clamp user messages to ~2k chars in
  the route handler. Prevents prompt-injection payload spam and
  caps cost.
- **No file uploads.** Out of scope; closes a major attack
  surface.
- **Cap message history sent to model** at ~10 turns. Keeps
  prompt size predictable; conversations longer than that aren't
  the use case.
- **Abuse heuristics deferred.** Don't over-engineer in v1; the
  rate limiter handles the obvious patterns. Revisit if logs
  show signal.

## 9. Observability (v1)

Minimal:

- **Vercel function logs** — already on, captures errors and
  cold-start metrics.
- **Anthropic dashboard** — token consumption, error rate.
- **Upstash dashboard** — query rate, free-tier usage.

We do **not** add a third-party tracing tool (LangSmith, Helicone,
Phoenix) in v1. They're useful for debugging but each adds a
vendor and a billing surface. If we hit a quality issue that
needs offline replay, that's the time to add one.

A simple manual eval against the [02 §5 rubric](./02-use-cases.md#5-behaviour-checklist-for-evals)
is what we do instead — see `06-evaluation.md` (planned).

## 10. Things explicitly out of scope for v1

- **Server-side conversation history.** Client-only state per
  [04 §5](./04-ui-integration.md#5-state-sessions-and-persistence).
- **Auth.** No login.
- **AISafety.info ingest.** Sister-site Q&A is its own surface.
  Hand-off via link.
- **Multimodal input.** No images, no file attachments.
- **Voice / audio.** Not justified by use cases.
- **Per-user personalisation.** No memory across sessions.
- **Translation.** Site is English-only; the assistant follows.
- **Search inside chat history.** Not a v1 feature.
- **Long-context corpus stuffing fallback.** We'd add this
  *only* if RAG retrieval quality turns out to be a problem and
  we want a cheap A/B comparison.

## 11. Stack-level open questions

These need a decision before code is written; flagging here so
they don't get lost:

- **Anthropic billing**: who owns the API key? Likely the same
  org account that owns the Vercel project. Set spending caps
  before launch.
- **Upstash free vs paid tier**: free tier is fine for v1 but
  has a fair-use cap on queries; we should set up billing
  defensively in case usage spikes.
- **Donation-guide refactor**: who lands the
  `src/data/donation-guide.ts` extraction? It touches the
  largest hand-written page on the site and should be reviewed
  carefully against the live site (per `CLAUDE.md`'s
  pixel-perfect rule).
- **Voyage vs OpenAI embeddings**: tie-breaker is "do we want a
  third vendor?". Defer until implementation; both are easy to
  swap.
- **Domain for /ask**: confirm it goes on `aisafety.com/ask` and
  not a subdomain. (Subdomain would mean separate cookies, CORS,
  which we don't want.)

The `proposal.md` collapses these into a delivery plan.
