# 03 — Architecture options

Given the corpus shape (~1,000 short documents, refreshed at every
Airtable change) and the use cases (route, recommend, walk the
donation tree), this doc lays out the architectural choices and
recommends a path.

## 1. The big-picture decision tree

There are three orthogonal architecture questions:

```
A. Where does the model's "knowledge" come from?
   ┌── A1. Pure prompted (no retrieval)                     ── small corpus only, capped
   ├── A2. RAG with vector retrieval                        ── flexible, cheap
   ├── A3. RAG with structured / hybrid retrieval           ── best for filters
   └── A4. Fine-tuning                                      ── overkill for this corpus

B. Where does inference run?
   ┌── B1. Vercel Edge Function calling external API        ── recommended
   ├── B2. Vercel serverless (Node)                         ── viable if Edge gives latency issues
   └── B3. Self-hosted on a separate box                    ── unnecessary complexity

C. How does the user interact?
   (covered in 04-ui-integration.md)
```

The rest of this doc walks A and B and ends with a concrete
recommendation.

## 2. Option A1 — Pure prompted, no retrieval

> Stuff the entire corpus (or a compressed summary of it) into the
> system prompt of a long-context model.

Math: ~1,000 docs × ~500 tokens average ≈ 500k tokens. That's at
the edge of what current long-context models accept (Claude
1M-token context is plausible; 200k is comfortable). Compressed —
strip duplicate fields, normalise whitespace, drop magic-row text —
we could probably get down to 200–300k tokens.

**Pros**

- No vector store, no embeddings, no retrieval bugs.
- Trivial to update — just rebuild the prompt at deploy time.
- Model sees the entire corpus, so it can answer
  "are there any X for Y in Z?" without depending on retrieval
  picking the right neighbours.

**Cons**

- Cost per query is dominated by input tokens. Even with prompt
  caching at, say, 90% discount, 200k cached + a few thousand
  fresh tokens × N daily users adds up. At Anthropic's current
  Sonnet 4.6 prices, ~$0.003 per cache hit means a busy site
  with 10k chats/day costs ~$30/day on input tokens alone — not
  prohibitive but not free.
- Per-query latency includes serializing & loading the cache;
  first-token latency is the main UX concern.
- If the corpus grows (e.g. someone adds an AISafety.info ingest,
  or the events table gets included in detail), this option
  silently degrades.
- Hard to enforce "only use sources we gave you" — the entire
  prompt is sources, but the model still has pretraining knowledge
  about Manifund etc.

Verdict: viable as a v0/MVP. Probably the fastest path to a working
demo. **But** if we know we want filters, citations, and growth
headroom, we should set up A2/A3 from the start.

## 3. Option A2 — RAG with vector retrieval

> Embed each document, store in a vector index, retrieve top-k by
> cosine similarity, pass retrieved docs into the model prompt.

This is the standard pattern. Trade-offs are well-understood:

- Embedding model: OpenAI `text-embedding-3-small` (1536-d, $0.02
  per 1M tokens), Cohere `embed-english-light-v3.0`,
  Voyage AI `voyage-3-lite`, or hosted options like
  Anthropic-via-Vertex. For ~1k short docs, total embedding cost
  is sub-dollar; recurring is cents per refresh.
- Vector store options:
  - **Vercel-native**: `@vercel/postgres` + pgvector. Lives in
    the same Vercel project as the site, no new vendor, scales
    way past anything we'd need.
  - **Upstash Vector**: serverless, edge-friendly REST API,
    free tier easily covers our corpus size. Lowest setup.
  - **Pinecone / Weaviate / Qdrant Cloud**: total overkill at
    this scale; introduces vendor lock-in and another
    dashboard.
  - **In-memory at build time**: bake the embeddings into a
    JSON file shipped with the build, do cosine in JS at query
    time. Plausible for ~1k docs but not 100k; if we ever index
    AISafety.info too, this breaks.
- k for retrieval: 8–15. The prompt budget is small (we want
  fast responses), and the corpus is small enough that highly
  relevant docs cluster tightly.

**Pros**

- Standard, debuggable, easy to extend.
- Makes failure modes explicit (when retrieval misses, the model
  has nothing to ground on, and the system prompt can tell it to
  say "I don't see that in our directory").
- Cheap at this scale.

**Cons**

- Pure vector retrieval is bad at hard filters (location, status,
  experience level). "Junior jobs in Berlin" gets fuzzed because
  embeddings don't distinguish "junior" from "entry-level" from
  "open to grads" reliably enough — and they really shouldn't be
  graded together with the *content* relevance.
- Needs a refresh story (see §6).

## 4. Option A3 — Hybrid: structured query + vector reranker

> The model decides which Airtable-style filter to apply (by
> emitting a tool call), the index returns matching records, vector
> similarity ranks within the filtered subset.

Concretely the assistant has 1–3 tools:

```ts
// Pseudocode
search_listings({
  type?: 'job' | 'community' | 'funder' | 'course' | 'org' | 'channel'
       | 'advisor' | 'project' | 'founder-tool' | 'event',
  location?: string,         // free text, matched against `location` field
  experience?: 'beginner' | 'mid' | 'senior',
  remote?: boolean,
  query?: string,            // free-text semantic match
  limit?: number,            // default 5
})

walk_donation_guide({
  amount: '$1–1k' | '$1k–10k' | '$10k–100k' | '$100k+',
  time:   '5min–1h' | '1–50h' | 'ongoing' | 'major',
})

get_page_summary({ path: '/communities' | '/jobs' | … })
```

The model picks `search_listings` for "Junior jobs in Berlin", and
the tool implementation does:

1. **Filter** the corpus by `type='job'`, `experience='junior'`,
   `location ~ 'Berlin' OR remote=true`.
2. Within the filtered set, rank by vector similarity to the user
   query.
3. Return the top 5 with full metadata.

This separates **what** matches from **how relevant**, which is
how Airtable's own filter sidebar works on each page already.

**Pros**

- Hard constraints actually get respected (no "Berlin job" being a
  San Francisco listing because the description mentions Europe).
- Tool calls produce structured, citable results — easy to render
  as cards in the chat UI.
- Works whether the underlying model is Claude, GPT-4, or open-source.
- Tools can be evaluated independently of the model: we can write
  unit tests for `search_listings` even before the chat exists.

**Cons**

- More moving parts: a tool runtime, parameter validation, error
  paths.
- The model has to *decide* to use the tools. Modern instruction-
  tuned models do this well, but you have to write good tool
  descriptions and a system prompt that nudges them away from
  free-form answering.

Verdict: this is what we should build for v1. The "tools over a
small structured corpus" pattern fits the site exactly: every
resource page is a filterable list, so the assistant should have
the same capabilities as the page's own filter sidebar.

## 5. Option A4 — Fine-tuning

Skipped for completeness:

- Corpus is too small (~500k tokens) and too volatile (refreshes
  weekly+). Fine-tuning bakes content into weights; updating means
  retraining.
- We don't need new behaviour; we need accurate retrieval. Fine-
  tuning solves the wrong problem.
- Would compete with built-in safety / refusal behaviours of the
  base model — net negative for a site that explicitly redirects
  conceptual questions to `aisafety.info`.

Don't do this.

## 6. Refreshing the index

Two events drive a corpus refresh:

1. **Airtable change** — already handled by
   `src/app/api/check-rebuild/route.ts`, which runs on a Vercel cron
   and triggers a redeploy when any tracked table has changes.
2. **Hand-edited page change** — the donation guide, about page,
   and homepage copy are version-controlled, so they refresh on every
   deploy.

The cleanest integration is to **hook the embedding refresh into the
existing deploy pipeline**:

```
Airtable change → check-rebuild cron → Vercel deploy hook → build
  → (during build) refresh-index step that diffs current corpus vs
    indexed embeddings and re-embeds anything that changed → upload
    deltas to vector store → continue build
```

The diff is keyed on `(record id, last-modified time)`. For ~1,000
records, even a full re-embed takes <10 s and costs <$0.01, so we
don't have to be clever about incrementality on day one — just full
rebuild every deploy is fine. We can switch to deltas if/when the
corpus grows.

A separate cron is also viable but less aligned with the existing
"every change goes through a deploy" pattern.

## 7. Where does inference run?

### B1 — Vercel Edge Function

The Vercel Edge runtime is a stripped-down V8 environment with
streaming response support (web streams). It's the natural home for
chat APIs in a Next.js project: low cold-start, geographic locality,
streaming-capable. Most LLM SDKs (Anthropic, OpenAI, Vercel AI SDK)
have edge-compatible builds.

**Pros**

- Streaming-first, low latency to the user.
- Same project as the site — no separate deploy.
- Vercel charges per invocation, not per uptime; a low-traffic
  chat costs near zero.

**Cons**

- Edge functions have CPU/memory limits. Tool calls that hit a
  serverless Postgres are fine; expensive in-process ML is not.
- Some libraries (`pgvector` Node client) don't run on Edge —
  have to use HTTP-based vector store APIs. Not a real
  constraint for our shortlist (Upstash is HTTP; Vercel Postgres
  has HTTP querying via `@vercel/postgres`).

### B2 — Vercel serverless (Node)

Same Vercel project, but the function runs in Node not V8. More
flexible runtime, slower cold start, otherwise identical billing.

Use this *only* if Edge has a constraint we can't work around.
First-token latency on chat is critical, so cold starts hurt.

### B3 — Self-hosted

Spin up a small VM (Render, Fly, Railway, Hetzner). Useful only if:

- We host our own model (we won't — see §5 above).
- We want a long-running process (we don't — chat is bursty).

Skip.

Verdict: **Edge function**, calling an external model API.

## 8. Streaming, sessions, and tool loops

A tool-using chat doesn't fit the simple "prompt in → tokens out"
streaming model. The flow looks like:

```
1. User message in (POST /api/chat).
2. Server starts streaming back via Vercel AI SDK.
3. Model emits a tool_use; server pauses streaming, runs tool,
   appends the result, restarts streaming.
4. Loop until model emits a final text response.
5. Stream closes.
```

The Vercel AI SDK (`ai` package) handles this natively for
Anthropic, OpenAI, and others. Worth using rather than rolling our
own — it gives us streaming UI hooks, tool-call rendering, and
deduplicated message state in React.

Sessions: probably we *don't* persist conversations server-side
in v1. Keep state in `useChat()` on the client (localStorage if we
want it across reloads). Lower scope, no PII to manage. We can add
server-side conversation history later if there's a strong reason.

## 9. Summary: recommended path

- **A3** (hybrid: tools + vector rerank within filtered subset).
- **B1** (Vercel Edge Function).
- **Refresh on deploy** alongside the existing `check-rebuild`
  flow; full re-embed each deploy until corpus growth makes
  deltas necessary.
- **No server-side conversation persistence** in v1.

Concrete model / vendor / code-level picks are in
[`05-recommended-stack.md`](./05-recommended-stack.md). UI choices
are in [`04-ui-integration.md`](./04-ui-integration.md).
