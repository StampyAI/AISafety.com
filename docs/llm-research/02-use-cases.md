# 02 — Use cases & response shape

This doc nails down what the assistant should *actually do*, with
concrete user queries, ideal response shapes, and out-of-scope cases
where the assistant should hand off elsewhere.

## 1. The user we're designing for

The site's audience splits roughly into:

- **Newcomers** — heard about AI safety, want to know what
  to do. Most likely to ask vague things like "how do I get
  involved?" Most likely to be sent to `aisafety.info` for
  conceptual context.
- **Career-changers / engineers / students** — already convinced,
  want a job, course, or community. Will ask scoped questions
  with implicit constraints ("I'm in Berlin", "I have weekends
  free", "I do empirical ML").
- **Donors** — have a number in mind and want to know where it
  should go. Often time-poor; the donation guide is already
  built for them.
- **Founders / org-builders** — looking for incubators, fiscal
  sponsors, funding pipelines. The smallest segment but a
  high-value one for the site.
- **Researchers / advisors / community organisers** — already
  embedded in the field; mostly use the directory pages
  directly. The assistant probably doesn't add much for them
  unless it does something they can't do by ctrl-F'ing a page.

Designing the response shapes for the first four buckets covers
roughly all the queries that benefit from natural language input.

## 2. What the assistant should do (and not do)

### In scope

1. **Route**: "Where on this site is X?" → name the page,
   one-sentence pitch, link.
2. **Recommend**: given soft constraints ("I have $5k", "I'm a
   junior software engineer in remote Europe"), surface the
   handful of listings that best match, each with a two-line
   reason and a link to the page they came from.
3. **Disambiguate / explain a listing**: "What's the difference
   between Manifund and AI Risk Mitigation Fund?" — answer
   from the descriptions and mark each link clearly.
4. **Walk the donation tree**: take a (donation amount, time
   budget) and produce the matching guidance from
   `/donation-guide`, citing the cell.
5. **Acknowledge gaps**: when there's no good match in the corpus,
   say so plainly and suggest the relevant page or `aisafety.info`.

### Out of scope (v1)

- **Conceptual AI-safety tutoring** ("what is reward hacking?",
  "how does RLHF work?"). Hand off to `aisafety.info`.
- **Personalised career coaching** beyond surfacing relevant
  listings. The site has *advisors* for that, and the assistant
  should suggest booking one.
- **News / current events.** The corpus is rebuilt only when
  Airtable changes; we have no news feed.
- **Anything that requires writing on the user's behalf** —
  no application drafting, no cover letters, no funding pitches.
  These are explicit anti-goals because they invite hallucinated
  facts about programs.
- **Free-form opinions on which org is "best"**. The assistant
  should stay descriptive (here's what each does) rather than
  prescriptive (X is better than Y).

## 3. Example queries → ideal responses

### Q1 — Routing (newcomer)

> "I just heard about AI safety. Where do I start?"

Ideal response:

```
Welcome — there's a few good entry points depending on what you want
to do.

- If you want to **understand** the problem first, the sister site
  [aisafety.info](https://aisafety.info) is the better starting
  point — it's structured as Q&A.
- If you want to **learn the field**, see [Self-Study](/self-study)
  for curated courses. Blue Dot Impact's intro courses are the most
  common starting point.
- If you want to **meet people**, [Communities](/communities) lists
  in-person and online groups; the AI Alignment Slack is the
  largest real-time community.

Want me to narrow this down — would you say you're more interested
in research, policy, or just getting context?
```

Key behaviours:

- Explicit hand-off to `aisafety.info` for conceptual learning.
- Cites pages on this site by their actual paths.
- Asks one follow-up question rather than dumping every option.
- Names a featured/canonical option per page (matches the
  homepage's "Featured" cards pattern).

### Q2 — Recommendation (engineer with constraints)

> "I'm a senior backend engineer based in London. I've done one Blue
> Dot course. Looking for a paid AI safety job."

Ideal response: surface 3–5 jobs from the `/jobs` Airtable that
match `seniority=senior`, `roleType=engineer`, `location=London or
remote-Europe`, recency<60d, with one-line "why" for each. Always
link back to `/jobs` and offer to filter further by sub-area.

Notably this is exactly the same query the page's filter sidebar
solves with checkboxes; the LLM's job is to *parse the natural
language into the same filters*, then summarise. **The LLM should
not invent jobs not in the corpus.**

### Q3 — Donation guide walk

> "I want to donate $2,000. I have an hour or two."

Ideal response: pull the `(donation_amount: "$1k–10k",
time_available: "1–50 hours")` cell from `/donation-guide`, present
its bulleted recommendations, and link the cell so the user can read
the full prose context. Optionally surface the
**AI Risk Mitigation Fund** entry from `/funding` as the canonical
"5 minutes" answer.

This is the cleanest case for the assistant because the human-curated
content is already structured as a decision tree; we just need to
match user inputs to a cell.

### Q4 — Org disambiguation

> "What's the difference between Manifund and the AI Risk
> Mitigation Fund?"

Ideal response: pull both records (from `/funding` and
`/donation-guide`'s embedded links), summarise the key axes
(grantmaker vs platform, who decides, ticket size), link both. If
the corpus only has one of them, say so honestly rather than
inferring the other from training-data knowledge.

This case is where hallucination risk is highest — the model
*will* know things about Manifund from pretraining. The system
prompt has to forbid using non-corpus knowledge for any factual
claim about a specific org.

### Q5 — Founder

> "I want to start an AI safety nonprofit. Where do I begin?"

Ideal response: route to `/founders`; surface
**Catalyze Impact** (incubator) and **Ashgro** (fiscal sponsor)
from the featured cards on that page, plus the related links to
`/funding` and `/events-and-training`. Offer to drill in: "Are you
at the pre-idea stage or do you have a project already?"

### Q6 — Hand-off (out of scope)

> "Why is alignment hard?"

Ideal response: short acknowledgement + redirect to
`aisafety.info`. *Do not attempt to answer from the model's own
knowledge.* The site's editorial position is "we curate, we don't
explain"; the assistant should reflect that.

### Q7 — Negative case (no match)

> "Are there any AI safety bootcamps in Lagos?"

Ideal response: honest "I don't see a Lagos-specific listing in our
directory. The closest in-person thing is X / the closest remote
options are Y. You could also check [Suggest a listing](...) if you
know of one."

This requires the assistant to know what the corpus *doesn't*
contain, which is easier when the retrieval threshold is honest
(see `03-architecture-options.md` on retrieval).

## 4. Response shape constraints

A consistent response template makes failure modes easier to spot
and makes the chat feel native to the site:

- **Always cite**: every concrete recommendation links to either
  a resource page (`/communities`) or, when the assistant has a
  specific record id, to the page that lists it. Never present
  a fact about a specific org without a link.
- **Prefer site links over external links** for navigation
  ("see [Funding](/funding)") so the user keeps a thread back to
  the directory. External links go on individual recommendations.
- **Short by default**: aim for ~150 words and ≤5 listings per
  answer. If the user wants more, they'll ask.
- **Markdown only** (no images), to match Next.js
  streaming-react-markdown patterns and keep the UI simple.
- **Suggest a follow-up** at the end of each non-trivial
  response, framed as a single question (not a multiple-choice
  menu) — mirrors Q1.

## 5. Behaviour checklist (for evals)

When we get to evaluations (`proposal.md` §evaluation), these are
the behaviours to grade per response, rough rubric:

- [ ] Every named org / fund / course is in the corpus
- [ ] Every named org / fund / course has a link
- [ ] Conceptual questions are routed to `aisafety.info`
- [ ] No more than 5 recommendations
- [ ] No invented requirements (e.g. saying a fellowship needs a PhD
      when the listing doesn't say so)
- [ ] Inactive listings are not surfaced unless explicitly asked
- [ ] Job recommendations >90 days old are not surfaced without a
      qualifier
- [ ] When the assistant doesn't know, it says so and suggests
      `Suggest a listing`
