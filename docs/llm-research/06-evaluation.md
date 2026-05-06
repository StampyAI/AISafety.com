# 06 — Evaluation

The use-cases doc ([02 §5](./02-use-cases.md#5-behaviour-checklist-for-evals))
sketches a behaviour rubric. This doc turns it into a concrete eval
plan: how the eval set is built, how a run is scored, and how the
harness fits into the existing project.

The headline: we do **not** need a fancy eval framework for v1. A
JSON file of ~30 hand-curated queries, an LLM-as-judge scoring
script, and a CI hook is enough — and is small enough that we
can actually keep it up to date.

## 1. Why eval matters more than usual here

Most LLM products can ship with vibes-based testing for a while.
This one can't, for two reasons specific to AISafety.com:

1. **Hallucinated organisations are a credibility hit.** The site
   exists to be a reliable directory. If the assistant invents a
   "Berlin AI safety fellowship" that doesn't exist — even
   plausibly — that's a worse failure mode than search returning
   nothing. Detecting hallucinations needs a corpus-grounded
   check, not vibes.
2. **The conceptual hand-off rule is unusual.** Most AI assistants
   are trained to be maximally helpful; ours is supposed to refuse
   conceptual questions and route to `aisafety.info`. That
   refusal is a *feature*, not a deficiency, and we need to
   measure that the model honours it under variation.

Both failure modes are easy to miss in dev — the model will
sometimes refuse and sometimes answer, depending on phrasing —
which is exactly what an eval set catches.

## 2. The eval set

### 2a. Size and shape

Target: **30 queries** for v1. This is small enough that:

- We can read the full output of every run in 15 minutes.
- Running the eval is cheap (~$1 per full run on Sonnet).
- We can hand-rewrite expected behaviours when the corpus shifts.

It's large enough that:

- It covers each of the [`02 §3`](./02-use-cases.md#3-example-queries--ideal-responses)
  use-case categories with 3–5 queries each.
- Pass-rate has signal at 5% increments (not 33%).

### 2b. Query categories

Distribution roughly:

| Category                      | Count | What's being tested                                                  |
| ----------------------------- | ----- | -------------------------------------------------------------------- |
| Routing (newcomer)            | 4     | Right page named, `aisafety.info` linked when conceptual.            |
| Recommendation (jobs)         | 5     | Correct filter parsing; only real listings; recency filter.          |
| Recommendation (communities)  | 4     | Correct filter parsing; real listings; activity-level signal.        |
| Recommendation (funding)      | 3     | Real funders; honest about open/closed status.                       |
| Recommendation (courses)      | 3     | Real courses; reasonable difficulty/length parsing.                  |
| Donation guide walks          | 4     | Right cell pulled; cell content cited verbatim or close.             |
| Disambiguation                | 2     | Two real entities compared; honest about gaps.                       |
| Founder questions             | 2     | Routes to `/founders`; surfaces featured cards.                      |
| Conceptual (must hand off)    | 3     | No attempt to answer; routed to `aisafety.info`.                     |
| Negative / no-match           | 2     | Honest "I don't see X"; suggests `Suggest a listing`.                |
| Adversarial / out-of-scope    | 2     | Won't write a cover letter, won't pick a "best", refuses gracefully. |

That's 34 — close enough to 30. Trim or pad to taste.

### 2c. File format

```jsonc
// eval/queries.jsonc
[
  {
    "id": "routing-newcomer-01",
    "category": "routing",
    "query": "I just heard about AI safety. Where do I start?",
    "expectations": {
      "links_aisafety_info": true,
      "names_pages": ["/self-study", "/communities"],
      "max_words": 200,
      "asks_one_followup": true,
      "no_invented_entities": true
    }
  },
  {
    "id": "rec-jobs-01",
    "category": "recommendation-jobs",
    "query": "Senior backend engineer in London, looking for AI safety work.",
    "expectations": {
      "tool_called": "searchListings",
      "tool_args_include": { "type": "job", "experience": "senior" },
      "min_listings": 3,
      "max_listings": 5,
      "all_listings_have_links": true,
      "no_invented_entities": true
    }
  },
  {
    "id": "donation-walk-01",
    "category": "donation",
    "query": "I have $2,000 to donate and an hour of time.",
    "expectations": {
      "tool_called": "walkDonationGuide",
      "tool_args": { "amount": "$1k-10k", "time": "1-50h" },
      "links_donation_guide_cell": true
    }
  },
  {
    "id": "conceptual-01",
    "category": "conceptual-handoff",
    "query": "Why is AI alignment hard?",
    "expectations": {
      "no_attempt_to_answer": true,
      "links_aisafety_info": true,
      "max_words": 80
    }
  }
  // … 30 more
]
```

The schema is intentionally narrow — boolean expectations are
easier to grade reliably than free-form rubrics. Each
`expectations` field maps to one row in the [`02 §5`](./02-use-cases.md#5-behaviour-checklist-for-evals)
rubric.

### 2d. Where it lives

`eval/queries.jsonc` (committed to the repo). This way:

- It's reviewable in PRs alongside prompt or tool changes.
- It versions naturally — when the corpus drifts, the diff
  shows up against the assistant's behaviour.
- A future contributor can read the eval set to understand
  what the assistant is supposed to do, without reading 5
  research docs.

Don't put it in `tests/` — it isn't a unit test, and it has its
own `npm run` lifecycle (see §4).

## 3. Scoring

### 3a. Two grading paths

| Expectation                           | How to grade                          |
| ------------------------------------- | ------------------------------------- |
| `tool_called`, `tool_args_include`    | Programmatic — read the tool-call log |
| `links_aisafety_info`                 | Programmatic — regex over response    |
| `names_pages`                         | Programmatic — string match           |
| `min_listings`, `max_listings`        | Programmatic — count link cards       |
| `all_listings_have_links`             | Programmatic — every entity → link    |
| `max_words`                           | Programmatic — word count             |
| `links_donation_guide_cell`           | Programmatic — URL fragment match     |
| `no_invented_entities`                | LLM-as-judge — see §3b                |
| `no_attempt_to_answer`                | LLM-as-judge — see §3b                |
| `asks_one_followup`                   | LLM-as-judge — see §3b                |

About 70% is programmatic. The rest needs a judge model.

### 3b. LLM-as-judge

For the subjective rows, run a *separate* model call (cheaper —
Haiku 4.5) with a strict rubric prompt:

```
You are grading an AISafety.com assistant response. The user
asked: "{query}". The assistant said: "{response}".

The corpus of real entities (extracted from the tool calls
this turn made) is: {tool_results_json}.

Answer YES or NO to each:
1. Does the response name any organisation, fund, course, job,
   or community that is NOT in the corpus above?
2. Does the response attempt to answer a conceptual AI-safety
   question (what is X, why does Y, how does Z work)?
3. Does the response end with at most one follow-up question?

Output JSON only: { "1": "YES|NO", "2": "YES|NO", "3": "YES|NO" }
```

Two important properties of the judge:

- **It only sees what was retrieved.** The judge can't accuse
  the model of inventing an entity that's actually in the
  corpus the model wasn't given. It's checking what the user
  *saw* against what the model *had*.
- **The judge is the same for every query.** No per-query
  rubric specialisation. This makes the judge cheap and
  reproducible.

### 3c. Pass thresholds

A query "passes" if **every** expectation evaluates true. A run
passes if pass-rate is **≥80%** (24/30 queries). 80% is the
launch gate; over time we want this north of 90%.

We do **not** report a single composite score (don't reduce a
multi-row rubric to a number — it loses the failure-mode
signal). Reports list pass-rate per category.

## 4. The harness

```
eval/
  queries.jsonc              # the 30 queries
  run.ts                     # runs the harness
  judge.ts                   # LLM-as-judge prompt + caller
  reporters/
    cli.ts                   # human-readable report
    junit.ts                 # CI-consumable XML
  fixtures/
    record-corpus.json       # snapshotted corpus for offline runs
  __snapshots__/
    last-run.json            # last full run; used for regression diffs
```

### 4a. `run.ts` flow

```
for each query in queries.jsonc:
  POST to /api/chat with { messages: [{ role: "user", content: query.query }] }
  collect: streaming text + tool_calls
  for each expectation in query.expectations:
    if programmatic: evaluate directly
    else: queue for judge batch
  judge batch: one Haiku call per query, parallel × 5
  collate: per-query pass/fail, per-row pass/fail
  output: cli reporter (and junit if --ci)
```

### 4b. Where it runs

- **Local**: `npm run eval` — runs against the dev server.
  Used during prompt iteration.
- **Pre-merge CI**: a GitHub Action that boots `next start` on
  the built artefact, runs the eval, fails the job if pass-rate
  drops by >5% vs `main`. (Soft gate; product owner can override.)
- **Post-deploy**: same eval against production after each
  deploy. Reports to a Slack webhook with diff vs last run.

### 4c. Fixturing the corpus for offline runs

Local dev shouldn't have to hit Airtable + Upstash + Voyage on
every eval run. The harness should support an
`--offline` mode that:

1. Snapshots the current Upstash Vector contents to
   `eval/fixtures/record-corpus.json` (a one-off command).
2. On subsequent runs, monkey-patches the tool runtime to
   serve from the fixture instead of the live store.

This is faster, deterministic, and doesn't burn Airtable rate
limit. The trade-off: fixture drift. The post-deploy hook runs
*online* against the real store, so corpus drift can't escape
detection.

## 5. Continuous evaluation

A few habits that make the eval useful long-term, rather than
"the test suite that ran once at launch":

- **Add a query whenever a real user query goes wrong.** If a
  visitor reports the assistant said something silly, the
  failing query goes into `queries.jsonc` with the expected
  behaviour before we touch the prompt to fix it. This grows
  the eval set with the *actual* failure modes the product
  produces, not our guesses.
- **Re-run on prompt changes.** Any PR touching
  `SYSTEM_PROMPT` or a tool description must show eval
  pass-rate before/after.
- **Re-run on corpus changes.** When `src/data/donation-guide.ts`
  or `src/data/page-summaries.ts` changes, re-run the relevant
  category. Catches "edited the donation guide; the assistant
  no longer pulls the right cell because the keyword changed".
- **Re-run on model bumps.** When Anthropic ships a new Sonnet
  or we want to A/B against Haiku, the eval is the basis for
  the comparison.

## 6. Things we are *not* going to do

- **Token-level eval suites (LM Eval Harness, HELM, etc.).**
  These are the wrong abstraction for product evals; they
  measure base-model capabilities, not "does the assistant do
  the right thing on AISafety.com".
- **Synthetic query generation.** Tempting (use an LLM to write
  more queries) but it's how eval sets become unrepresentative.
  Hand-curate. Real-user queries when we have them.
- **A "RAGAS" / faithfulness metric.** The judge prompt above
  covers what RAGAS does for our use case. Adding a framework
  is overkill for 30 queries.
- **Per-query golden answers.** Boolean expectations are more
  stable than golden text — text grading needs constant rewrites
  whenever the corpus shifts.
- **Hooking into Anthropic's eval product.** Maybe later, once
  we have signal that needs offline replay.

## 7. Eval as launch gate

The proposal ([`proposal.md` §5](./proposal.md#5-delivery-plan))
gates v1 launch on the eval. Specifically:

> [ ] Run the [`02 §5`](./02-use-cases.md#5-behaviour-checklist-for-evals)
> rubric over a hand-curated 30-query eval set; iterate prompt +
> tools until ≥80% pass per row.

"Per row" is the important word — a single failing category
(e.g. "conceptual hand-off" sitting at 60%) blocks launch even
if overall pass-rate is 85%. Otherwise the model could pass on
the easy categories and fail on the ones that matter most.

## 8. Worked example: scoring `routing-newcomer-01`

Query:

> "I just heard about AI safety. Where do I start?"

Suppose the model responds:

> Welcome! There's a few good starting points:
> - To **understand** the problem, the sister site
>   [aisafety.info](https://aisafety.info) is the best
>   starting point — it's structured as Q&A.
> - To **learn the field**, see [Self-Study](/self-study)
>   for curated courses.
> - To **meet people**, [Communities](/communities) lists
>   in-person and online groups.
>
> Want me to narrow this down — are you more interested in
> research, policy, or just getting context?

Programmatic checks:

- `links_aisafety_info`: ✅ (regex hits)
- `names_pages: ["/self-study", "/communities"]`: ✅ (both
  appear)
- `max_words: 200`: ✅ (response is ~75 words)

Judge checks (one Haiku call):

- `asks_one_followup`: ✅ (the trailing line is a single
  question, not a multiple-choice menu)
- `no_invented_entities`: ✅ (no entity named, only the two
  pages, which are real)

All pass → query passes.

## 9. Open questions for §11 of the proposal

These need to be resolved before the eval set is finalised:

- Who curates the eval set? Probably the same person owning the
  prompt — having one author for both keeps the rubric
  internally consistent.
- Where do real-user queries come from? Currently nothing — no
  `/api/chat/feedback` endpoint exists. We'd add one
  alongside v1 if we want to grow the eval set from real usage
  (privacy review needed first).
- CI minutes budget: an LLM-as-judge eval costs ~$1 and
  60s per full run. If we run it on every PR, budget is in the
  $10–50/month range — fine, but worth confirming.
- Snapshot-the-vector-store mode: who owns the script that
  exports `eval/fixtures/record-corpus.json`? Probably one-off
  per minor corpus refactor; if it gets heavy, automate.

The proposal's §9 "what we still need before code" already
includes "agreed eval set as v1 launch gate"; this doc gives
that line concrete shape.
