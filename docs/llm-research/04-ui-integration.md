# 04 — UI integration

How does the assistant surface to the user? This is largely a product
question, but the answer constrains the technical work, so it belongs
here.

## 1. The three viable surfaces

### Option U1 — Floating widget on every page

A pinned chat bubble in the bottom-right that opens into a modal
chat panel. This is the canonical "site assistant" UX, used by
companies like Stripe, Vercel, and a hundred SaaS docs sites.

**Pros**

- Always available — supports the assistant's role as a
  navigator (the user might be halfway down `/jobs` and want to
  ask "do you have anything in Berlin?" in context).
- Doesn't require a dedicated route, so the homepage and other
  curated layouts stay the same.
- Easy to A/B-test: hide the bubble for half of users.

**Cons**

- Visual clutter on a site that is currently very minimal.
  Aesthetics and design pressure here are real — see
  `docs/css-guidelines.md` and `CLAUDE.md` ("pixel-perfect
  migration, not a redesign").
- "Pinned chat bubble" is the most cliché AI UX — it
  invites users to ask it to write essays. Anti-aligned with our
  scope (use-cases doc).
- On mobile, the bubble eats real estate and competes with the
  navigation bar.

### Option U2 — Dedicated `/ask` (or `/find`) page

A full chat page reachable from the navigation. Opens with a small
set of suggested queries ("How do I get started?", "Where should I
donate $5k?"), then a chat thread.

**Pros**

- Fits the site's information-architecture: it's just another
  resource page. We can put it in the nav alongside `/jobs`,
  `/funding`, etc.
- Suggests an editorial frame: the assistant is a *tool we're
  offering*, not an omnipresent overlay.
- Discoverable via search (real URL, can have OG metadata).
- Easy to land directly with prefilled queries from the
  homepage ("not sure where to start?").

**Cons**

- Less convenient as a true sitewide tool — the user has to
  leave their current page to ask. Mitigated by linking from
  every resource page footer ("can't find what you're looking
  for? ask the assistant").
- Doesn't naturally answer "is X on this page?" because the
  user has to leave the page to ask.

### Option U3 — Embedded inline-on-resource-pages

Drop a query box into each resource page's hero (above the filter
sidebar): "Describe what you're looking for in one sentence".
Behaves like a smart filter: parses the natural-language input and
applies the page's existing filter sidebar.

**Pros**

- Closest to what would actually be useful: the existing pages
  already have filter sidebars, the assistant just translates
  "junior remote European jobs" into the right checkboxes.
- No chat thread, no conversational baggage. Single
  query → filtered page. Hard for the model to hallucinate
  because the only output is a structured filter call.
- Reuses every page's existing UI; minimal new components.

**Cons**

- Doesn't handle conversational follow-ups, donation guide
  walks, or "what page should I go to" routing.
- Repeated work to wire up per page.

### My read

These are not exclusive; the strongest plan is a combination:

- **U2 as the home for conversational use cases** (donation
  walks, routing, multi-turn). Reachable as `/ask` (or maybe
  `/find` — naming below).
- **U3 on jobs and communities**, where the filter sidebar is
  rich and the natural-language → filter translation is most
  valuable.
- **U1 deferred.** A floating widget is the right thing
  *eventually* but not in v1. Ship the dedicated page first;
  see if usage justifies adding a sitewide bubble.

## 2. Naming

The page should not be called `/chat` — that frames it as
"talk to a chatbot", which is exactly the wrong frame for a site
that is a directory. Better candidates:

- `/ask` — the verb fits ("ask AISafety.com a question"). Short,
  navigable, no jargon.
- `/find` — fits the routing/recommendation use case but reads
  like a search box.
- `/guide` — too overloaded; conflicts with `/donation-guide`.
- `/assistant` — generic.

Recommendation: **`/ask`**. Add to nav; keep the icon visually
distinct (a question mark or sparkle, not a chat-bubble).

## 3. Page layout sketch

The site uses a constraint-based design system with `.button-primary`,
`.text-field`, `.container-default`, etc. The chat page should be
built from those tokens — no new colours, no new fonts.

Rough layout (top to bottom):

```
┌─────────────────────────────────────────────────────┐
│  Navigation (existing)                              │
├─────────────────────────────────────────────────────┤
│  <h1>Ask AISafety.com</h1>                          │
│  Short blurb: this assistant helps you navigate     │
│  the directory; it doesn't answer conceptual AI     │
│  safety questions (link to aisafety.info).         │
│                                                     │
│  Suggested starting points (chips):                 │
│   [ How do I get started? ]                         │
│   [ Where should I donate $5k? ]                    │
│   [ Junior jobs in Berlin? ]                        │
│   [ How do I start an AI safety org? ]              │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Conversation                                  │  │
│  │ • messages stream in here                     │  │
│  │ • assistant cards link out to /jobs etc.      │  │
│  │ • each cited record shows logo + one-liner    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [.text-field — ask anything... ]   [send]         │
│                                                     │
│  small print: "based on AISafety.com's directory.   │
│   for conceptual AI safety questions, see           │
│   aisafety.info."                                   │
└─────────────────────────────────────────────────────┘
```

Components we already have:

- `.text-field` for the input — perfect, reuse as-is.
- `.button-primary` for "send".
- `Navigation`, `Footer` come from `LayoutShell` for free.
- `FeaturedCard` and the listing-card pattern for rendering cited
  results — listing rows in chat replies should reuse the same
  visual style as the resource pages so the user sees a single
  consistent "card" idiom across the site.

Components we'd need to build (small):

- `ChatThread.tsx` — renders `messages` via the Vercel AI SDK
  `useChat()` hook.
- `ChatMessage.tsx` — assistant messages render markdown +
  optional citation cards.
- `ListingCard.tsx` — compact card for citing a `/jobs`,
  `/communities`, etc. record. Could probably borrow from
  `FeaturedCard` rather than building new.

## 4. Hooking it into the rest of the site

- **Nav entry**: add `/ask` to the navigation, last item. Mind
  that `Navigation.tsx` already overflows into a `+N` dropdown
  past `MIN_OVERFLOW = 5`; the new entry will join the dropdown
  on small screens.
- **CTA on resource pages**: at the bottom of `/jobs`,
  `/funding`, `/communities`, etc., add a small "can't find what
  you're looking for? ask the assistant" link. Avoids needing a
  global widget while still surfacing the feature.
- **Homepage tile**: could add a small `Ask` card to the
  homepage grid, or fold it into the existing "Stay informed"
  section. Defer until v1 ships and we have engagement data.

## 5. State, sessions, and persistence

In v1: **state lives in `useChat()` on the client**. No server
session persistence. No login. No history across browser tabs.

This intentional simplicity has a few useful properties:

- No PII to manage. Conversations stay in the user's browser.
- No DB schema beyond what the corpus index needs.
- Easy to "start over" — just refresh the page.

If we later want to (a) measure quality with thumbs up/down or
(b) let users come back to a thread, we can add:

- localStorage for thread history (no server change).
- A POST `/api/chat/feedback` endpoint that logs to
  Postgres or a Slack webhook. Simple, additive.

## 6. Streaming & loading states

The Vercel AI SDK exposes a `useChat()` hook that handles streaming
out of the box. Important UX details to get right:

- **First-token latency** matters more than total latency. Show a
  loading shimmer until the first token arrives, then replace it
  with the streaming text. Don't show the whole response after
  it finishes.
- **Tool-call rendering**: when the model calls
  `search_listings`, the UI should show a small "Searching the
  directory…" status, not the raw tool call. When the result
  comes back, fade in the cards. The user shouldn't see JSON.
- **Errors**: a 500 from the chat endpoint should produce a
  graceful "Something went wrong — try again or browse
  [Jobs](/jobs) directly". No stack traces.
- **Rate limit / abuse**: a basic IP rate limiter on
  `/api/chat` (e.g. 30 messages per IP per hour) prevents the
  obvious abuse vectors. Use Upstash Redis (free tier) or
  Vercel KV.

## 7. Accessibility

- Input must be reachable by tab; `aria-label` on the textarea.
- Streaming messages should not steal focus.
- Use `role="log"` and `aria-live="polite"` on the message list
  so screen readers announce new content without interrupting.
- The "send" button must be disabled when empty (already a
  pattern via `.button-primary` + `disabled`).
- All cited links must have visible link styling, not "buttonised"
  cards without underlines.

## 8. Bottom-up vs top-down rollout

Two ways to actually ship this:

- **Top-down**: build the dedicated `/ask` page, pre-launch it
  with an "experimental" tag in the nav, gather feedback, then
  consider U3 (inline-on-page filter parsing) later.
- **Bottom-up**: ship U3 first as a smart filter on `/jobs`
  ("describe what you're looking for"), use the same backend
  for U2 later. Less ambitious but lower-risk; the natural-
  language → filter translation is a tighter problem.

Top-down is closer to the original brief ("sitewide LLM
assistant"). Bottom-up is more conservative; it builds the
backend incrementally and avoids committing to a chat surface
before we know how it'll be used.

The **proposal.md** §rollout plan lays out a v0 → v1 → v1.5 path
that does both — start with a single-turn `/ask` that recommends
listings, add multi-turn and the inline filter as v1.5 once we
have evals.
