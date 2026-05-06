# Proposal: a sitewide assistant for AISafety.com

> **Status:** research-stage proposal. No `src/` changes yet. This
> document collapses the analysis in
> [`01–05`](./README.md#document-index) into a single readable
> brief with a concrete v1 → v1.5 → v2 plan.

## 1. The one-paragraph version

Build a small, scoped LLM assistant — branded **"Ask"** at
`aisafety.com/ask` — whose job is to *navigate the directory*,
not to teach AI safety. It uses Claude Sonnet 4.6 with three
tools (`searchListings`, `walkDonationGuide`, `getPageSummary`)
backed by a Voyage-embedded, Upstash-Vector-stored corpus of
~1,000 short documents derived from the same Airtable tables and
hand-written pages the site already renders. The corpus rebuilds
inside `next build`, hooked into the existing
`/api/check-rebuild` cron. The chat runs on a Vercel Edge
function, streams via the Vercel AI SDK, and persists nothing
server-side. Conceptual "what is X?" questions are explicitly
out of scope and are routed to `aisafety.info`.

## 2. Why this scope and not something broader

The site is a directory, not a publication. It has ~1,000
records of short structured content and a handful of curated
hand-written pages. There's no editorial corpus to ground an
"AI safety tutor" on; trying to build one from training data
alone would either hallucinate or duplicate `aisafety.info`. The
*one* thing this site can do uniquely well, and that the existing
filter sidebars don't already do, is parse natural-language
constraints into the right page and the right listings:

- "I have $5k to donate and an hour" → cell of `/donation-guide`.
- "I'm a junior backend in remote Europe" → 3 jobs from `/jobs`.
- "I want to start an AI-safety nonprofit" → `/founders` + the
  featured incubators.

That framing — *navigator, not tutor* — drives every architecture
choice that follows. See [`01`](./01-content-inventory.md) for the
content audit, [`02`](./02-use-cases.md) for the worked examples.

## 3. Design at a glance

```
┌────────────────────────────┐
│  /ask page (Next.js)       │
│  • <ChatThread />          │
│  • useChat() (AI SDK)      │
└────────────┬───────────────┘
             │ POST /api/chat (Edge)
             ▼
┌────────────────────────────┐
│  streamText(model, tools)  │
│  Claude Sonnet 4.6         │
└─┬───────────────────────┬──┘
  │ tool_use              │ tool_result → continue
  ▼                       │
┌──────────────────────┐  │
│ searchListings       │  │
│ walkDonationGuide    │──┘
│ getPageSummary       │
└──┬───────────────┬───┘
   │ filter+rank   │ static lookup
   ▼               ▼
┌─────────────┐  ┌─────────────────────────┐
│ Upstash     │  │ src/data/               │
│ Vector      │  │  donation-guide.ts      │
│ (~1k docs,  │  │  page-summaries.ts      │
│  metadata)  │  │ (committed in repo)     │
└──────▲──────┘  └─────────────────────────┘
       │
       │ upsert at next build
       │
┌──────┴──────────────────────┐
│ src/lib/data/* loaders      │
│ (existing Airtable readers) │
└─────────────────────────────┘
```

Pieces in detail:

- **Frontend** — single `/ask` page, components built from
  existing CSS tokens (`.button-primary`, `.text-field`,
  `.container-default`); see [`04 §3`](./04-ui-integration.md#3-page-layout-sketch).
- **API** — `src/app/api/chat/route.ts`, Edge runtime, streams
  via Vercel AI SDK.
- **Tools** — three: a hybrid filter+rerank search over the
  vector store, a donation-guide cell lookup, a page-summary
  lookup. See [`05 §5c`](./05-recommended-stack.md#5c-tool-definitions).
- **Index** — Voyage-embedded vectors in Upstash, rebuilt
  inside `next build` from the same loaders the site uses for
  static rendering. See [`05 §7`](./05-recommended-stack.md#7-index-build-pipeline).
- **Refresh** — piggybacks on the existing `check-rebuild` cron
  (see `src/app/api/check-rebuild/route.ts`); no new cron.

## 4. Behavioural contract

The full eval rubric is [`02 §5`](./02-use-cases.md#5-behaviour-checklist-for-evals).
Highlights:

- ✅ Every named org / fund / course / community is in the
  retrieved tool results — not invented.
- ✅ Every recommendation has a link.
- ✅ Conceptual questions are routed to `aisafety.info`.
- ✅ ≤5 listings per response, ~150 words by default.
- ✅ Inactive listings, stale jobs (>90 days), unpublished
  records are suppressed unless the user explicitly asks.
- ❌ No cover-letter writing, application drafting, or
  prescriptive "X is the best" rankings.

## 5. Delivery plan

### v0 — internal demo (1–2 weeks of focused work)

Goal: prove the loop works end-to-end on a subset of the corpus.

- [ ] Add `ai`, `@ai-sdk/anthropic`, `@upstash/vector`,
      `voyageai`, `zod` deps.
- [ ] Set up Upstash Vector index, Anthropic API key, Voyage
      API key. Set Vercel project env vars.
- [ ] Build `src/scripts/build-index.ts` that ingests **just
      `/communities`** and writes embeddings to Upstash. Wire it
      into `next build`.
- [ ] Build `src/app/api/chat/route.ts` (Edge) with **just
      `searchListings`** as a tool (filtered to communities).
- [ ] Build a minimal `/ask` page with `useChat()` and a
      single text-area. No design polish.
- [ ] Hand-test the example queries from
      [`02 §3`](./02-use-cases.md#3-example-queries--ideal-responses)
      that are answerable from communities alone (Q1, parts of Q2).
- [ ] Ship behind `/ask?preview=1` or a feature flag.

Definition of done: a developer can hit the page locally, ask
"online communities for ML engineers" and get a sensible 3-card
response with working links.

### v1 — public launch (3–4 weeks after v0)

Goal: cover all directory pages, ship the donation-guide walk,
add the polish needed to be visible in the site nav.

- [ ] Extract `/donation-guide` text into
      `src/data/donation-guide.ts` (one source of truth — see
      [`05 §7b`](./05-recommended-stack.md#7b-avoiding-two-source-of-truth-files)).
- [ ] Hand-write `src/data/page-summaries.ts` for the ~12 page
      summaries (homepage, `/about`, resource page intros,
      `/events-and-training`, `/founders`).
- [ ] Extend `build-index.ts` to cover all 10 Airtable tables
      + the donation-guide cells + the page summaries.
      Respect `Publish?`/`Hide?` filters and skip the `/map`
      magic rows (`MAGIC_ROW_NAMES` in `src/lib/data/map.ts`).
- [ ] Add `walkDonationGuide` and `getPageSummary` tools.
- [ ] Add `@upstash/ratelimit` (30 msg/IP/hour).
- [ ] Build out `ChatThread.tsx`, `ChatMessage.tsx`,
      `ListingCard.tsx` (reusing `FeaturedCard`).
- [ ] Add CTA links from the bottom of `/jobs`, `/funding`,
      `/communities`, `/self-study`, `/founders` to `/ask`.
- [ ] Add `/ask` to `Navigation.tsx` (it'll land in the `+N`
      overflow on small screens, which is fine for v1).
- [ ] Run the [`02 §5`](./02-use-cases.md#5-behaviour-checklist-for-evals)
      rubric over a hand-curated 30-query eval set; iterate
      prompt + tools until ≥80% pass per row.
- [ ] Confirm `next build` cost & wall time stays acceptable
      (likely <30s delta).
- [ ] Confirm `/api/check-rebuild` integration: a record edit
      in Airtable produces a deploy that re-embeds the changed
      record. Test by editing a record and checking the
      vector store.

Definition of done: the assistant passes the rubric on the
eval set, all listings cite real records, no listed query
generates content the corpus doesn't contain.

### v1.5 — inline filter on `/jobs` and `/communities`

Goal: take the natural-language → filter translation that
`searchListings` already does and surface it inline on the
two pages with the heaviest filter sidebars.

- [ ] Add a "Describe what you're looking for" input box to
      the top of `/jobs` and `/communities`.
- [ ] On submit: call a *cheaper* version of the same backend
      (Haiku 4.5 with **only** the `searchListings` tool, no
      free-form chat output) that returns the structured filter
      arguments only.
- [ ] Apply the returned arguments to the page's existing
      `FilterSidebar` state.
- [ ] Show a "we interpreted: junior • Berlin • remote" pill so
      the user can correct the parse if it's wrong.

Definition of done: a user typing "junior remote backend
in Europe" on `/jobs` gets the page filtered to a sensible
subset, with a reset path if they don't like the parse.

### v2 — only if usage justifies (deferred)

- Floating widget across the site ([`04 §U1`](./04-ui-integration.md#option-u1--floating-widget-on-every-page)).
- Server-side conversation history + thumbs up/down feedback
  for offline eval replay.
- Ingest of `aisafety.info` content as a separate corpus, with
  the assistant routing across both directories — only if
  cross-site routing quality issues warrant it.
- "Suggest a listing" auto-draft from chat: if the assistant
  fails to find a match, offer to pre-fill the suggest-listing
  form with the user's query.

## 6. Cost ballpark

Numbers below are order-of-magnitude — exact figures depend on
traffic. Sources & assumptions:

- Sonnet 4.6 input ≈ $3/Mtok, output ≈ $15/Mtok.
- Haiku 4.5 ~10× cheaper.
- Voyage `voyage-3-lite` ≈ $0.02/Mtok.
- Upstash Vector free tier covers our corpus.
- Vercel Edge invocations ≈ free at expected volume.

| Scenario                         | Daily chats | Avg in tok | Avg out tok | Sonnet $/day |
| -------------------------------- | ----------- | ---------- | ----------- | ------------ |
| Quiet (early launch)             | 50          | 2,000      | 600         | $0.75        |
| Busy (post-launch + virality)    | 1,000       | 2,000      | 600         | $15          |
| Peak (top-of-HN-day equivalent)  | 10,000      | 2,000      | 600         | $150         |

Index rebuild costs (Voyage embeddings): <$0.01/deploy. Upstash
Vector & Redis on free tier; ratelimit caps abuse before it
becomes a billing surprise. **The dominant cost is Sonnet output
tokens at chat time**; switching to Haiku for cost-sensitive
flows would drop the busy-case to ~$1.50/day.

Set Anthropic spending caps before launch ([`05 §11`](./05-recommended-stack.md#11-stack-level-open-questions)).

## 7. Risks & mitigations

| Risk                                                              | Likelihood | Impact | Mitigation                                                                                  |
| ----------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| Model invents an org / fellowship not in corpus                   | medium     | high   | System prompt forbids; eval rubric checks; tool-only sourcing for any specific named entity |
| Retrieval misses the right listing                                | medium     | medium | Hybrid filter+rerank ([`03 §A3`](./03-architecture-options.md)); ≥k=8 retrieval; eval set   |
| Stale job recommended (posted >90 days ago)                       | medium     | medium | `lastUpdated` in metadata; system prompt rule; tool can drop stale jobs at retrieval        |
| Conceptual hand-off fails ("here's what RLHF is …")               | medium     | medium | Prompt rule; eval row; can add a hard-coded refusal pre-check on conceptual keyword set     |
| Donation-guide drift (page edited but corpus not updated)         | low        | high   | Single source of truth in `src/data/donation-guide.ts`; build-time index ([`05 §7b`](./05-recommended-stack.md#7b-avoiding-two-source-of-truth-files))   |
| Cost spike from abuse                                             | low        | medium | IP rate limit (30/hr); message length cap; spending cap on Anthropic                        |
| Index serving stale data after Airtable edit                      | low        | low    | Same `check-rebuild` cron as the site; index rebuild is part of deploy                      |
| `/map` magic rows leak into corpus                                | low        | low    | Loader already filters them via `MAGIC_ROW_NAMES`; reuse the loader                         |
| Inactive orgs surfaced when user wants something current          | low        | low    | `status` in metadata; default-filter at retrieval; eval row                                 |
| Aesthetic clash with site's minimal design                        | low        | medium | Reuse existing CSS tokens; no new colours/fonts; defer floating widget                      |
| `/ask` becomes the only entry point and pages get less use        | low        | medium | CTAs link *to* the assistant from pages, not *away*; assistant always links back to pages   |

## 8. Decision log

Cross-referenced from earlier docs so reviewers don't have to
hop. Each decision has its full context behind the link.

- **Architecture**: hybrid retrieval (tools + filtered vector
  rerank), not pure vector RAG, not prompt stuffing, not
  fine-tuning. — [`03 §9`](./03-architecture-options.md#9-summary-recommended-path)
- **Runtime**: Vercel Edge function, calling external Anthropic
  API. Not Node, not self-hosted. — [`03 §7`](./03-architecture-options.md#7-where-does-inference-run)
- **UI**: dedicated `/ask` page (U2). Inline filter on `/jobs`
  + `/communities` is v1.5. Floating widget (U1) deferred to
  v2. — [`04 §1`](./04-ui-integration.md#1-the-three-viable-surfaces)
- **State**: client-only via `useChat()`, no server-side
  conversation history in v1. — [`04 §5`](./04-ui-integration.md#5-state-sessions-and-persistence)
- **Model**: Claude Sonnet 4.6 primary, Haiku 4.5 fallback /
  cheap mode. — [`05 §1`](./05-recommended-stack.md#1-chat-model)
- **Embeddings**: Voyage `voyage-3-lite` (or OpenAI
  `text-embedding-3-small`). — [`05 §2`](./05-recommended-stack.md#2-embeddings)
- **Vector store**: Upstash Vector. — [`05 §3`](./05-recommended-stack.md#3-vector-store)
- **SDK**: Vercel AI SDK (`ai` + `@ai-sdk/anthropic`). — [`05 §5`](./05-recommended-stack.md#5-sdk--orchestration)
- **Index refresh**: inside `next build`, hooked into the
  existing `check-rebuild` cron. — [`05 §7`](./05-recommended-stack.md#7-index-build-pipeline)
- **Out of scope for v1**: AISafety.info ingest, server-side
  history, auth, multimodal, voice, translation. — [`05 §10`](./05-recommended-stack.md#10-things-explicitly-out-of-scope-for-v1)

## 9. What we still need before code

In rough priority order:

1. **Approval to proceed with v0.** This proposal isn't yet a
   green light from anyone — it's a recommendation.
2. **Anthropic & Voyage & Upstash accounts.** Single billing
   owner, spending caps configured.
3. **Decision on third-party embeddings vs OpenAI.** See
   [`05 §11`](./05-recommended-stack.md#11-stack-level-open-questions).
4. **Donation-guide refactor commitment.** The
   `src/data/donation-guide.ts` extraction is a precondition for
   v1, not v0; can be parallelised but should be assigned.
5. **Eval set.** A hand-curated 30-query set against the
   [`02 §5`](./02-use-cases.md#5-behaviour-checklist-for-evals)
   rubric, agreed on before v0 ships, used as the v1 launch gate.
6. **Naming + nav placement confirmation.** "Ask" reads well;
   confirm with whoever owns site IA.

## 10. What this proposal is *not*

- Not a green light to start coding `src/`. The steering doc
  is explicit: research only, no source edits.
- Not a redesign — every UI element reuses existing CSS tokens
  (`CLAUDE.md`'s pixel-perfect rule).
- Not a replacement for any existing page or feature. The
  assistant is additive; it routes *to* the directory, not
  *around* it.
- Not a roadmap to a general "AI safety chatbot" — that's
  `aisafety.info`'s job, and we link to it.

---

For deeper background on any choice above, follow the link in
the decision log. The rest of `docs/llm-research/` is the full
working document.
