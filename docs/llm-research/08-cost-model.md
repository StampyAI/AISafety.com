# 08 — Cost model

`proposal.md` §6 has a back-of-envelope table. This doc shows
the working — what each cost component is, how it scales, and
where the budget should be capped.

The TL;DR: **chat-time output tokens dominate everything else
by 1–2 orders of magnitude.** Embeddings, vector ops, and
infra are rounding errors. If we want to control cost, the
lever is "how often we call Sonnet vs Haiku, and how long the
responses are".

## 1. Cost components

### 1a. Per chat turn (the dominant cost)

A single user → assistant exchange goes through:

- 1 LLM call to decide on tools (model reads system + history + user message).
- N tool calls (typically 1–2).
- 1 LLM call to produce the final response (model reads system + history + user + tool results).

Some implementations chain these into a single billed
streaming call rather than two; the token math is similar.

Token breakdown for a typical turn:

| Component                     | Tokens (typical)             |
| ----------------------------- | ---------------------------- |
| System prompt                 | 600                          |
| Tool definitions              | 400                          |
| Conversation history (cap 10) | 0–4,000                      |
| User message                  | 50–200                       |
| Tool results                  | 800–2,000                    |
| Final response                | 300–800 output               |

Rounded numbers we'll use:

- **Average input**: 2,000 tokens (system + tools + light history + user + ~1 tool call worth of results).
- **Average output**: 600 tokens.

These are the numbers `proposal.md` §6 uses. They're
conservative — early turns will be smaller, late turns in a
conversation can be larger. We don't include prompt caching
yet; see §3.

### 1b. Per index rebuild

Index rebuild happens inside `next build`, ideally
incrementally. Cost components:

| Component                | Per full re-embed        | Per delta re-embed (typical) |
| ------------------------ | ------------------------ | ---------------------------- |
| Voyage `voyage-3-lite`   | 200k tok @ $0.02/Mtok    | 5k tok @ $0.02/Mtok          |
| Upstash Vector upserts   | 1,000 ops (free)         | 25 ops (free)                |
| Build-time wall delta    | ~10s                     | <1s                          |

**Full re-embed cost**: $0.004. **Delta cost**: ~$0.0001.

We can run this on every deploy without thinking about it.

### 1c. Per query: vector lookup

Each chat turn does 1 `searchListings` call against Upstash
Vector. Upstash Vector pricing:

- Free tier: 10k queries/day.
- Paid: $0.40 per 100k queries.

At 1,000 chats/day with 2 vector lookups average, we'd be at
2,000 queries/day — comfortably free tier. We don't need to
budget for this.

### 1d. Per query: rate limit / abuse infra

`@upstash/ratelimit` uses Upstash Redis:

- Free tier: 10k requests/day.
- Paid: $0.20/100k requests.

Same story — we're squarely in free tier. Skip in budget.

### 1e. Hosting & networking

- Vercel Edge function invocations: free at our scale.
- Streaming bandwidth: irrelevant.
- Vercel build minutes: same as today; the index step adds
  <30s.

Skip in budget.

### 1f. Embedding the user query at chat time

Each `searchListings` tool call needs to embed the user's
free-text `query` argument (50–200 tokens) before doing the
vector lookup. That's a Voyage call:

- 1,000 chats/day × 1 search × 100 tokens = 100k tokens/day = $0.002/day.

Skip in budget.

## 2. Three traffic regimes

Numbers calculated from §1a using:

- Sonnet 4.6: input $3/Mtok, output $15/Mtok.
- Haiku 4.5: input $0.80/Mtok, output $4/Mtok (illustrative;
  bump to current at implementation).

### 2a. Quiet — early launch, just discovery

Assume **50 chats/day**, average 4 turns/chat = 200 turns/day.

| Cost line              | Sonnet path                         | Haiku path                       |
| ---------------------- | ----------------------------------- | -------------------------------- |
| Input (200 × 2k tok)   | 400k tok × $3/M = $1.20            | 400k tok × $0.80/M = $0.32       |
| Output (200 × 600 tok) | 120k tok × $15/M = $1.80           | 120k tok × $4/M = $0.48          |
| **Total / day**        | **$3.00**                           | **$0.80**                        |
| **Total / month**      | **$90**                             | **$24**                          |

At quiet volumes, model choice barely matters in absolute
terms. Sonnet is the right default — quality matters more
than $66/month.

### 2b. Busy — post-launch, sustained interest

Assume **1,000 chats/day**, 4 turns/chat = 4,000 turns/day.

| Cost line              | Sonnet path                         | Haiku path                       |
| ---------------------- | ----------------------------------- | -------------------------------- |
| Input (4k × 2k tok)    | 8M tok × $3/M = $24                 | 8M tok × $0.80/M = $6.40         |
| Output (4k × 600 tok)  | 2.4M tok × $15/M = $36              | 2.4M tok × $4/M = $9.60          |
| **Total / day**        | **$60**                             | **$16**                          |
| **Total / month**      | **$1,800**                          | **$480**                         |

At busy volumes the gap is real — $1,300/month difference. If
we hit this regime sustainably, the right move is a
**routing model**: a Haiku call decides whether the query
needs Sonnet (open-ended recommendation) or Haiku is fine
(routing, donation walk). See §4.

### 2c. Peak — top-of-HN-day-equivalent

Assume **10,000 chats/day**, 4 turns/chat = 40,000 turns/day.
This is a viral spike, not a baseline.

| Cost line              | Sonnet path                          | Haiku path                       |
| ---------------------- | ------------------------------------ | -------------------------------- |
| Input (40k × 2k tok)   | 80M tok × $3/M = $240                | 80M tok × $0.80/M = $64          |
| Output (40k × 600 tok) | 24M tok × $15/M = $360               | 24M tok × $4/M = $96             |
| **Total / day**        | **$600**                             | **$160**                         |

A *single* viral day on Sonnet is $600. Sustained at this rate
is $18,000/month — not realistic for the site's traffic
profile, but worth budget-capping for. The
[`proposal.md` §11 spending caps line](./proposal.md#11-stack-level-open-questions)
matters.

### 2d. What `chats/day` actually means

A "chat" here is a single user session, averaging 4 turns. A
turn is one model output. The 4-turn average comes from
benchmark data on similar directory-style assistants; typical
distributions are heavy-tailed (most chats are 1–2 turns; a few
are 10+).

For modelling purposes, total turn count is what matters. If
we instead model 200 chats/day × 1 turn/chat (instead of 50 ×
4) we'd get the same numbers — every cost above scales linearly
with turns.

## 3. Prompt caching

Anthropic offers prompt caching: a cached prefix is billed at
~10% of normal input rate. Our system prompt + tool definitions
(~1,000 tokens) is constant per turn, so caching it cuts the
input cost by ~50%.

Including caching in the busy regime:

- Cached prefix: 1,000 tok × 4,000 turns × $0.30/M = $1.20/day.
- Uncached input: 1,000 tok × 4,000 turns × $3/M = $12/day.
- Total input: $13.20/day vs $24/day uncached.

That's a $300/month win at busy traffic, ~$30/month at quiet.
The Vercel AI SDK + Anthropic SDK support caching with a
`cacheControl` flag on the relevant message blocks; one-line
change in the chat route. **Worth doing in v1.**

Cache TTL is 5 minutes by default, refreshed on hit. Our
system prompt is hit on every turn, so cache stays warm. For
busy volumes, consider the 1-hour cache (more expensive
per write but cheaper per hit when the system prompt is shared
across thousands of users).

## 4. Cost optimisation levers, in order of impact

If we hit the busy regime and want to reduce cost without
sacrificing quality:

### 4a. Route open-ended → Sonnet, routine → Haiku

A small classifier (could be Haiku or even a hand-written
heuristic) decides:

- Routing queries ("where is X on the site?") → Haiku.
- Donation-guide walks (mostly mechanical) → Haiku.
- Open-ended recommendations ("I'm a junior in Berlin, looking
  for…") → Sonnet.

If 50% of queries route to Haiku, busy daily cost drops from
$60 to ~$38, a 37% saving. The quality cost is real — Haiku is
worse at long-context reasoning — but the pre-classifier means
the *user* never sees Haiku doing something it's bad at.

### 4b. Trim the system prompt + tools

Current sketch is ~1,000 tokens of system + tools per turn.
Each 100 tokens trimmed saves ~$0.30/day at busy and proportional
amounts elsewhere. Worth a focused pass at v1 — the
[`05 §6`](./05-recommended-stack.md#6-system-prompt-skeleton)
prompt has room to compress.

### 4c. Cap output length

Lower `maxTokens` from 1024 to 768 saves ~25% of output cost
in the worst case. Most responses don't hit the cap; this is a
ceiling, not an average. The [`02 §4`](./02-use-cases.md#4-response-shape-constraints)
"~150 words" target is well below 768 tokens, so the cap is
mostly a runaway-protection.

### 4d. Cache the donation-guide walk responses

`walkDonationGuide` is deterministic — same `(amount, time)`
gives the same content. We can serve it without an LLM
call entirely: tool returns the cell, the API directly
returns a templated response without going back through the
model.

The trade-off: less natural phrasing. Worth A/B-ing if we hit
the regime where donation walks are a meaningful fraction of
volume.

### 4e. Reduce conversation history cap

Currently capped at 10 turns ([`05 §8b`](./05-recommended-stack.md#8b-other-safeguards-low-cost-high-value)).
Dropping to 6 saves input tokens on long conversations.
Marginal at typical conversation length.

## 5. What we should *not* do for cost

- **Self-hosting**. Adds operational cost (a VM that's there
  even when no one's chatting) that easily exceeds the API cost
  it saves. Only makes sense at >$10k/month API spend.
- **Switching to a smaller, lower-quality model** (e.g.
  open-source 7B). Quality cost is too high for the savings.
- **Removing tools to make prompts shorter.** Each tool earns
  its keep; removing one would shift work to the system prompt
  or to the model's freeform reasoning, both worse.
- **Reducing eval frequency to save the eval's own cost.** Evals
  are the cheapest insurance we have; running them on every PR
  pays for itself in caught regressions.

## 6. Spending caps and alerting

Concrete numbers worth setting in the Anthropic dashboard:

- **Hard cap**: $1,500/month. Triggers a kill switch that
  fails closed (chat returns "the assistant is temporarily
  unavailable, please use the directory directly").
- **Soft alert**: $200/month sustained. Triggers a Slack ping
  to whoever owns the assistant.
- **Daily anomaly alert**: 5× the previous 7-day average daily
  spend. Catches abuse spikes early.

These numbers assume the busy regime is the worst-case for
sustained traffic. If the site genuinely grows past that,
revise upward.

In Vercel, set a **build minutes** cap so a runaway index step
can't burn the build budget. Index build is cheap (<30s) but
worth bounding.

## 7. Worked example: a one-month projection

If launch goes as expected — slow ramp from quiet to busy
over 4 weeks — projected cost:

| Week | Chats/day | Sonnet $/day (with cache) | Sonnet $/week |
| ---- | --------- | ------------------------- | ------------- |
| 1    | 50        | $1.50                     | $10           |
| 2    | 200       | $6                        | $42           |
| 3    | 500       | $15                       | $105          |
| 4    | 1,000     | $30                       | $210          |
|      |           |                           | **~$370**     |

Plus index/embeddings/infra: <$1/week.

So **~$370 for the first month, with growth from 50 to 1,000
chats/day**. This is well under the $1,500 hard cap and well
under any reasonable site-budget threshold.

## 8. Open questions for §11 of the proposal

- Who owns the Anthropic billing relationship? Likely the same
  legal entity that owns the site domain.
- What's the spending-cap escalation path? "Notify whom" — we
  need a designated on-call once spending alerts are wired.
- Is the routing-model optimisation (§4a) worth doing in v1, or
  defer to v1.5? My read: defer. Quiet-regime cost is small
  enough that we don't need it; busy-regime triggers the
  optimisation as a "we hit X chats/day, time to add a router"
  task.
- Are we comfortable with the kill-switch behaviour at hard cap?
  Failing closed (chat unavailable) is the right default for a
  cost cap, but worth product-side confirmation.
