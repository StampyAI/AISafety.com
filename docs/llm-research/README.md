# Sitewide LLM for AISafety.com — Research

This directory holds research and design notes for adding an LLM-powered assistant to AISafety.com. It is research output only — no source files in `src/` are touched from this work.

## Working hypothesis

AISafety.com is a curated directory of \~10 resource pages backed by \~10 Airtable tables (\~1,000 listings total). The site has no editorial articles — all content is either short structured records (org/job/funder descriptions, \~50–500 words) or short bespoke prose on `/about`, `/donation-guide`, `/founders`, etc.

Given that profile, a good LLM assistant for this site is **not a general-purpose AI safety tutor**. The sister site [aisafety.info](https://aisafety.info) already covers conceptual Q&A. What this site can do uniquely well is help a visitor **find the right resource out of the directory**: "I have $5k to donate, where should it go?", "I'm a software engineer in London — which community should I join?", "What courses can I take in 4 weeks?".

That framing — *navigator over the directory*, not *AI safety tutor* — shapes most of the architectural choices below.

## Document index

The notes in this directory build up in roughly this order; each is a self-contained piece you can read on its own.

### Main thread

1. [`01-content-inventory.md`](./01-content-inventory.md) — what's on the site, which Airtable tables back it, and how to turn that into a retrieval corpus.
2. [`02-use-cases.md`](./02-use-cases.md) — what the assistant should actually do, with concrete example queries and the ideal response shape.
3. [`03-architecture-options.md`](./03-architecture-options.md) — trade-offs between RAG, fine-tuning, structured query, and hybrid approaches; where inference runs; how often the index updates.
4. [`04-ui-integration.md`](./04-ui-integration.md) — how the assistant surfaces in the Next.js app: floating widget vs `/ask` page vs inline-on-page; what reusable UI exists.
5. [`05-recommended-stack.md`](./05-recommended-stack.md) — concrete model / vector store / embedding / hosting picks with reasoning.
6. [`proposal.md`](./proposal.md) — the consolidated proposal: scope, v0 → v1 → v1.5 → v2 plan, costs, risks, decision log.

### Deepening notes (read after the main thread)

7. [`06-evaluation.md`](./06-evaluation.md) — eval set, rubric, and continuous-evaluation harness.
8. [`07-prompt-injection.md`](./07-prompt-injection.md) — what an adversarial Airtable record could do, and how to neutralise it.
9. [`08-cost-model.md`](./08-cost-model.md) — detailed unit economics under three traffic regimes.

## Constraints (from the steering doc)

- No edits to `src/`. Research and docs only.
- Don't run `next dev` in this working tree.
- Read `CLAUDE.md` before starting (already done).

## Status

In progress. See the most recent commits for what's freshly added; this README's index is the source of truth for what each file is about.