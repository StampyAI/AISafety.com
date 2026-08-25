# Architecture Documentation

## Overview

AISafety.com is a **Next.js 16 web application** using the App Router pattern. It serves as a community hub for AI safety resources, pulling content from Airtable.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
├─────────────────────────────────────────────────────────────┤
│  Pages (SSR)           │  Client Components                  │
│  - Homepage            │  - D3Map (interactive map)          │
│  - Events              │  - LastUpdated (dynamic dates)      │
│  - Map page            │  - UpButton (scroll behavior)       │
└────────────┬───────────┴──────────────┬─────────────────────┘
             │                          │
             ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER                            │
├─────────────────────────────────────────────────────────────┤
│  API Routes (src/app/api/)                                   │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ /api/map        │  │ /api/last-updated│                  │
│  │ GET: all orgs   │  │ GET: timestamps  │                  │
│  │ 5-min cache     │  │ 5-min cache      │                  │
│  └────────┬────────┘  └────────┬─────────┘                  │
└───────────┼────────────────────┼────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      AIRTABLE                                │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Map Table       │  │ Metadata Table  │                   │
│  │ 323+ orgs       │  │ Last updated    │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Server vs Client Components

| Component   | Rendering | Why                                           |
| ----------- | --------- | --------------------------------------------- |
| Navigation  | Server    | Static content, no interactivity              |
| Footer      | Server    | Static content                                |
| D3Map       | Client    | D3 requires DOM access, zoom/pan interactions |
| LastUpdated | Client    | Fetches data after hydration                  |
| Pages       | Server    | SEO, faster initial load                      |

### 2. Data Fetching Strategy

- **API Routes as proxy**: Don't expose Airtable credentials to client
- **5-minute cache**: `{ next: { revalidate: 300 } }` balances freshness with performance
- **Pagination handling**: Airtable returns max 100 records, API loops to get all

### 3. Styling: Constraint-Based CSS

Instead of Tailwind's unlimited utilities, this project enforces a design system:

```css
/* Allowed spacing values (globals.css) */
.padding-4px, .padding-8px, .padding-12px, .padding-16px,
.padding-24px, .padding-32px, .padding-40px, .padding-56px,
.padding-80px, .padding-104px

/* Color palette */
--teal-100 through --teal-900 (grays with teal tint)
--bright-teal-300, --bright-teal-500 (accent colors)
```

**Rationale**: Prevents arbitrary values that break visual consistency. If you need `padding-bottom: 14px`, the answer is "use 12px or 16px instead."

### 4. No Global State Library

Current state management uses only React's built-in hooks:

- `useState` for local component state
- `useEffect` for side effects
- No Redux, Zustand, or Context API needed yet

This is appropriate given the app's current complexity. Consider adding global state if:

- Multiple unrelated components need the same data
- You're prop-drilling more than 2-3 levels deep

## API Reference

### GET /api/map

Returns all organizations for the field map.

**Response:**

```json
{
  "records": [
    {
      "id": "rec123",
      "title": "Anthropic",
      "shortName": null,
      "description": "AI safety company...",
      "category": "Research Lab",
      "status": "Active",
      "logo": "https://...",
      "mapLogo": "https://...",
      "link": "https://anthropic.com",
      "x": 45.3,
      "y": 15.9,
      "scale": "Large",
      "isMagic": false
    }
  ],
  "lastUpdated": "2026-01-15",
  "count": 323
}
```

### GET /api/last-updated/map

### GET /api/last-updated/events

Returns timestamp for when data was last updated.

**Response:**

```json
{
  "lastUpdated": "2026-01-15T00:00:00.000Z",
  "formattedDate": "15 January 2026"
}
```

## File Organization

```
src/app/
├── layout.tsx          # Root layout - wraps all pages
├── globals.css         # ALL styles live here
├── page.tsx            # Homepage
├── not-found.tsx       # 404 page
├── map/
│   ├── page.tsx        # Map page (fetches data, renders D3Map)
│   ├── D3Map.tsx       # Client component with D3 visualization
│   ├── layout.tsx      # Map-specific layout
│   └── page.module.css # Map-specific styles
├── events/
│   └── page.tsx
├── training/
│   └── page.tsx
└── api/
    ├── map/
    │   └── route.ts    # Main data endpoint
    └── last-updated/
        ├── map/route.ts
        └── events/route.ts
```

## Admin map editor

`/admin/map` (owner password only, `mapEditor` capability in
`src/lib/admin/auth.ts`) lets the owner drag logos on the Field map and writes
the record's `x`/`y` to Airtable via `/api/admin/map` (GET live records,
PATCH one move). It is deliberately a **copy** of the public map's rendering,
not a shared component: `src/lib/admin/map-geometry.ts` mirrors the constants
in `src/app/map/D3Map.tsx` and `map-geometry.test.ts` fails if they drift.
The editor reads Airtable directly with `cache: 'no-store'` (unpublished rows
included, `Hide?` rows excluded) – never through `fetchAirtableRecords` /
`unstable_cache` – and never revalidates anything, so `/map`'s data path,
cache and bundle are untouched. The only Airtable fields it can write are `x`
and `y` (`buildPositionFields` in `map-editor-core.ts`; any other key in the
request body is rejected). Publish?/Hide?/Scale stay in Airtable.

## Deployment

- **Platform**: Vercel (recommended for Next.js)
- **Environment Variables**: Set in Vercel dashboard
- **Build**: `npm run build` (automatic on push)

## Future Considerations

### Component Extraction Opportunities

As more pages are built, consider extracting:

- **Card components** (currently inline in homepage)
- **Page header/title pattern**
- **Airtable embed wrapper**
- **Filter/search UI** (for jobs, communities pages)

### Testing

Unit tests run with Vitest (`npm test`, files `src/**/*.test.ts`, node
environment, `@` alias resolves to `src`). Pure modules only – nothing that
imports Next, d3 or the DOM. E2E is still manual (Playwright headless against a
local server, especially for the D3 map).

### Performance

- Images use `next/image` for optimization
- Consider adding `loading="lazy"` to below-fold images
- D3 map could benefit from virtualization for very large datasets
