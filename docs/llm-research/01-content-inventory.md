# 01 — Content Inventory & Corpus Design

Before deciding *how* to retrieve, we have to nail down *what* we are
retrieving over. This is a survey of every distinct piece of content the
assistant could ground answers in, and a proposal for how to turn that
into a retrieval corpus.

## 1. Where the content lives

There are three sources of content on the site:

### 1a. Airtable (the bulk of it)

Ten tables, all keyed in `src/app/api/check-rebuild/route.ts` and read at
build time via `src/lib/data/*`:

| Page              | Airtable table id     | Loader (`src/lib/data/`) | Approx fields                                                                                |
| ----------------- | --------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `/map`            | `tblvzbGL9q9dOO9Nc`   | `map.ts`                 | Long name, Short name, Description, Category, Status, Logo, Link, Scale, x/y coords          |
| `/communities`    | `tbluI5Dll697WiSm8`   | `communities.ts`         | Name, Description, Logo, Platform, Type, Activity level, Focus, Join link, Location, Size    |
| `/funding`        | `tblzMTLDZWZKqTxrq`   | `funding.ts`             | Name, Description, Logo, Type, Recipient type, Accepting applications?, Website              |
| `/jobs`           | `tblyLelYCQjP6w3nV`   | `jobs.ts`                | Title, Description, Org, Skill set, Location, Min experience, Role type, Work location, Date |
| `/self-study`     | `tblRNYJ0m1cmJXKKk`   | `self-study.ts`          | Name, Description, Category, Type, Created by, Link, Logo                                    |
| `/advisors`       | `tblf3KKYnmgcjVGhD`   | `advisors.ts`            | Name, Description, Logo, Focus, Status, Link                                                 |
| `/projects`       | `tblHT29QNgMYKB8iW`   | `projects.ts`            | Project Name, Description (short), Status, Contact name, Contact email                       |
| `/media-channels` | `tblCTOMzyH3vILL5I`   | `media-channels.ts`      | Name, Description, Image, Type, Link                                                         |
| `/founders`       | `tbl59Ye8oxvPjoVJv`   | `founders.ts`            | Name, Sort, Type, Image, Description, Website                                                |
| `/events…`        | `tblx0L8qJEaLBxJFS`   | (embed)                  | Name, dates, format, location — currently rendered via Airtable embed, not custom loader     |

`/communities`, `/funding`, `/self-study`, `/advisors`, `/projects`,
`/media-channels`, and `/founders` all filter on `{Publish?} = TRUE() AND
{Hide?} = FALSE()`. Everything we surface should respect that filter.

Per `counts.ts`, total published listings sit at roughly:

- ~325 map orgs (323 + magic rows; the table also stores 4 magic
  utility rows like "Last updated" we'd want to skip when indexing)
- ~250–400 events (Airtable's embed is the source of truth; not yet
  in `src/lib/data/`)
- low-100s each of communities, jobs, courses, funders, channels,
  advisors, projects, founder resources

That's well under 2,000 records total — small enough that a vector
store is overkill on storage, but useful for semantic relevance.

### 1b. Hand-written page text (smaller but rich)

Text that is checked into the repo, not pulled from Airtable:

- `/about` — team bios, mission, funding context, volunteer/feedback
  pathways. ~500 words.
- `/donation-guide` — the most complex hand-written content on the
  site: a 4×4 decision tree (donation amount × time available) of
  recommendations, with embedded links to specific funds and
  platforms (`Manifund`, `GiveWiki`, `Nonlinear Network`,
  `AI Risk Mitigation Fund`, donor lottery, etc.). ~1,500 words.
- `/page.tsx` (homepage) — short navigation copy describing each
  resource page in one sentence. Useful as a high-level "what is
  on this site?" summary.
- `/founders` — page itself has hand-written introductory copy plus
  curated featured cards (Ashgro, Catalyze Impact) on top of the
  Airtable list.
- `/events-and-training` — explanatory copy + links to the
  newsletter / suggest-listing forms.
- `/not-found.tsx`, `/poster-map` — irrelevant to assistant.

### 1c. External / sister-site content (out of scope for v1)

The site repeatedly defers conceptual questions to
[aisafety.info](https://aisafety.info), the sister Q&A site. The
homepage and the donation guide both link out to it. For a v1 we
should *not* try to ingest that site's content — it has its own search
and Q&A surface. The right behaviour is for our assistant to
acknowledge when a question is conceptual ("what *is* AI safety?")
and route the user there.

`public/llms.txt` already exists and is a clean machine-readable index
of the site's resource pages. We can ship that to crawlers and reuse
the same structure as a top-level summary doc inside the corpus.

## 2. Proposed corpus structure

A retrieval corpus needs three things: a stable **id**, a chunked
**text** field, and **metadata** for filtering / display.

### 2a. One document per Airtable record, plus the page-level prose

For the structured listings, the natural document granularity is
**one Airtable record == one document**. Records are short (50–500
words of description plus structured metadata) and self-contained;
breaking them further by sentence would lose the "this is a
fellowship in London" context that makes them retrievable.

```jsonc
{
  "id": "airtable:communities:recXXXXXXXXXXXXXX",
  "page": "/communities",
  "type": "community",
  "title": "AI Alignment Slack",
  "text": "AI Alignment Slack — Online community on Slack...\nFocus: Technical AI safety, alignment research...\nActivity level: Very active\nSize: 5,000+ members\nJoin link: ...",
  "metadata": {
    "platform": ["Slack"],
    "type": ["Online community"],
    "activityLevel": "Very active",
    "location": null,
    "url": "https://join.slack.com/...",
    "logo": "/images/airtable-cache/att...png",
    "lastUpdated": "2026-04-12T..."
  }
}
```

The `text` field is the embedding target; it's the human-readable
serialisation of the structured fields plus the description, ordered
the way a human would describe the listing aloud. The structured
metadata is kept alongside so the UI can render a card without going
back to Airtable, and so we can filter (e.g. only "online communities"
when the user asked about online ones).

For the hand-written pages, there are two reasonable choices:

- **Per-section chunking** for `/donation-guide` and `/about` —
  the donation guide is naturally chunked by `(donation_amount,
  time_available)` cell of its decision tree, so 4 amounts × 4
  time bands = 16 chunks. Each is its own retrievable document.
- **Per-page summary** for the homepage and the resource-page
  intros — a single 100–200 word document each, summarising what
  that page is for. These do double duty: they answer "where do I
  find X?" routing questions and they help the model decide
  *which* listings to surface.

### 2b. Document type taxonomy (informs filters and prompts)

| Type           | Source                           | Approx count |
| -------------- | -------------------------------- | ------------ |
| `org`          | `/map` records                   | ~320         |
| `community`    | `/communities` records           | ~80          |
| `funder`       | `/funding` records               | ~30          |
| `job`          | `/jobs` records                  | ~150–300     |
| `course`       | `/self-study` records            | ~80          |
| `advisor`      | `/advisors` records              | ~20          |
| `project`      | `/projects` records              | ~30          |
| `channel`      | `/media-channels` records        | ~80          |
| `founder-tool` | `/founders` records              | ~40          |
| `event`        | `/events-and-training` (TBD)     | varies       |
| `page`         | hand-written page summaries      | ~10          |
| `guide-chunk`  | donation-guide decision-tree row | ~16          |

Total ballpark: **~900–1,200 documents**, all short. That fits
comfortably in any vector index, and is also small enough that we
could skip embeddings entirely and just send the whole compressed
corpus to a long-context model — see options in `03-architecture-options.md`.

### 2c. Metadata fields worth indexing for filtering

These are the fields users will phrase queries around, so they should
be kept structured (not just in the embedding text):

- `type` (community, funder, job, etc.) — almost every user query
  implies one or two types
- `category` / `focus` (technical vs governance vs advocacy)
- `location` and `workLocation` (remote / city / country) — for
  jobs and in-person communities
- `experience` (beginner / mid / senior) — for jobs and courses
- `acceptingApplications` (open / closed) — for funders
- `activityLevel` and `size` — for communities
- `status` (active / inactive) — to suppress dead listings
- `lastUpdated` — for "newest first" tie-breaks

## 3. Refresh cadence

The site rebuilds when Airtable changes via
`/api/check-rebuild/route.ts`, hit on a Vercel cron. Two options for
the index:

- **Rebuild the index in the same flow.** When `check-rebuild`
  triggers a deploy, also re-embed any rows whose `LAST_MODIFIED_TIME`
  is newer than the last index timestamp. This is what we want.
- **Rebuild on a separate schedule.** Less aligned with the existing
  pattern; introduces a window where the chat references stale
  records.

The amount of churn is small: a typical week probably touches
single-digit-to-tens of records, so re-embedding is cheap (cents) and
fast (seconds). We should index incrementally rather than rebuild
from scratch each time.

## 4. Things to be careful about

- **`Publish?` and `Hide?` filters.** Anything that bypasses these
  would surface unpublished or moderation-flagged records. The
  pipeline must read from the same view IDs / formulas the live
  pages use, not the raw tables.
- **Magic rows on `/map`.** The map table has 4 utility rows
  (`Merch`, `Last updated`, `Suggest correction`, `Suggest entry`)
  that look like orgs in raw data — `map.ts` skips them via
  `MAGIC_ROW_NAMES`. The corpus pipeline must too.
- **Image URLs.** `airtable.ts` re-hosts attachments under
  `/images/airtable-cache/` at build. The corpus should store the
  *cached* path (or the original Airtable URL) consistently with
  what the chat UI will render — easiest is to mirror the build-time
  loader's output rather than hit Airtable again.
- **Inactive orgs.** `/map` keeps records with `Status: Inactive`
  but sorts them last. The assistant probably *should* surface
  them when the user is asking historically ("who used to do X?")
  but *should not* surface them when the user is asking for an
  active fellowship right now. `status` belongs in metadata.
- **Job recency.** Jobs go stale fast. The job loader sorts by
  `Date published`, descending. The assistant should never recommend
  a job posted >90 days ago without a strong qualifier.
- **Donation guide structure.** The guide is a 2-axis decision tree;
  the retrievable chunks should encode *both* axes in metadata
  (`donation_amount: "$1k–10k"`, `time_available: "1–50 hours"`) so
  the assistant can pick the right cell when both axes are known.
