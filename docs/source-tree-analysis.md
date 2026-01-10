---
title: Source Tree Analysis
description: Directory structure, file purposes, and entry points
generated: 2026-01-10
---

# AISafety.com - Source Tree Analysis

## Complete Directory Structure

```
AISafety.com/
├── .claude/                    # Claude Code configuration (AI assistant)
├── .git/                       # Git repository
├── .husky/                     # Git hooks configuration
│   └── pre-commit             # Runs lint-staged before commits
├── _bmad/                      # BMAD workflow system (development tooling)
├── _bmad-output/               # BMAD generated artifacts
├── backup/                     # WebFlow export backups
├── docs/                       # Project documentation (this directory)
├── public/                     # Static assets
│   ├── images/                # Image assets
│   │   ├── logo.svg          # Site logo
│   │   ├── bg.svg            # Background pattern
│   │   ├── *.svg             # Icons (calendar, map, globe, etc.)
│   │   ├── *.png             # Raster images
│   │   └── *.webp            # Optimized photos
│   ├── file.svg              # Default Next.js assets
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src/                        # Source code ← MAIN APPLICATION
│   ├── app/                   # Next.js App Router
│   │   ├── api/              # API Routes
│   │   │   ├── map/
│   │   │   │   └── route.ts  # GET /api/map - Organization data
│   │   │   └── last-updated/
│   │   │       ├── events/
│   │   │       │   └── route.ts  # GET /api/last-updated/events
│   │   │       └── map/
│   │   │           └── route.ts  # GET /api/last-updated/map
│   │   ├── events-and-training/
│   │   │   └── page.tsx      # Events & Training page
│   │   ├── map/
│   │   │   ├── D3Map.tsx     # D3.js interactive map component
│   │   │   ├── layout.tsx    # Map page layout
│   │   │   ├── page.module.css # Map-specific styles
│   │   │   └── page.tsx      # Map page with filters
│   │   ├── favicon.ico       # Site favicon
│   │   ├── globals.css       # Global styles (WebFlow + Tailwind)
│   │   ├── layout.tsx        # Root layout (Nav + Footer)
│   │   ├── not-found.tsx     # 404 page
│   │   └── page.tsx          # Home page
│   └── components/            # Shared React components
│       ├── Footer.tsx        # Site footer
│       ├── LastUpdated.tsx   # Dynamic timestamp component
│       ├── Navigation.tsx    # Site header/navigation
│       └── UpButton.tsx      # Scroll-to-top button
├── .env.local                  # Environment variables (gitignored)
├── .gitignore                  # Git ignore patterns
├── .nvmrc                      # Node version (pinned)
├── .prettierignore             # Prettier ignore patterns
├── .prettierrc.json            # Prettier configuration
├── CLAUDE.md                   # AI assistant instructions
├── README.md                   # Project README
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js configuration
├── package-lock.json           # Dependency lock file
├── package.json                # Project dependencies
├── postcss.config.mjs          # PostCSS configuration (Tailwind)
└── tsconfig.json               # TypeScript configuration
```

## Critical Directories

### `src/app/` - Application Pages

The heart of the application using Next.js App Router conventions.

| Path                           | Purpose                         | Key Files                               |
| ------------------------------ | ------------------------------- | --------------------------------------- |
| `src/app/`                     | Root route (`/`)                | `page.tsx`, `layout.tsx`, `globals.css` |
| `src/app/api/`                 | API endpoints                   | Server-side data fetching               |
| `src/app/map/`                 | Map feature (`/map`)            | D3Map component, filters, cards         |
| `src/app/events-and-training/` | Events (`/events-and-training`) | Airtable embeds                         |

### `src/components/` - Shared Components

Reusable UI components used across multiple pages.

| Component         | Lines | Purpose                            |
| ----------------- | ----- | ---------------------------------- |
| `Navigation.tsx`  | 60    | Site header with nav links         |
| `Footer.tsx`      | 104   | Site footer with links, newsletter |
| `LastUpdated.tsx` | 107   | Dynamic "last updated" display     |
| `UpButton.tsx`    | ~30   | Scroll-to-top functionality        |

### `src/app/api/` - API Routes

Server-side endpoints for data fetching.

| Endpoint                   | File                           | Purpose                               |
| -------------------------- | ------------------------------ | ------------------------------------- |
| `/api/map`                 | `map/route.ts`                 | Fetch organization data from Airtable |
| `/api/last-updated/events` | `last-updated/events/route.ts` | Events metadata                       |
| `/api/last-updated/map`    | `last-updated/map/route.ts`    | Map metadata                          |

### `public/images/` - Static Assets

All static images served directly by Next.js.

| Type        | Count | Examples                              |
| ----------- | ----- | ------------------------------------- |
| SVG Icons   | ~15   | `logo.svg`, `calendar.svg`, `map.svg` |
| PNG Images  | ~10   | `thumbnails.png`, `faces-desktop.png` |
| WebP Photos | ~3    | `hands-COMPRESSED.webp`               |

## Entry Points

### Application Entry

- **Root Layout:** `src/app/layout.tsx`
  - Loads Inter font
  - Renders Navigation and Footer
  - Wraps all page content

### Page Entry Points

| URL                    | Entry Point                            | Description     |
| ---------------------- | -------------------------------------- | --------------- |
| `/`                    | `src/app/page.tsx`                     | Home page       |
| `/map`                 | `src/app/map/page.tsx`                 | Interactive map |
| `/events-and-training` | `src/app/events-and-training/page.tsx` | Events listing  |
| `/*` (404)             | `src/app/not-found.tsx`                | Not found page  |

### API Entry Points

| URL                        | Entry Point                                | Method |
| -------------------------- | ------------------------------------------ | ------ |
| `/api/map`                 | `src/app/api/map/route.ts`                 | GET    |
| `/api/last-updated/events` | `src/app/api/last-updated/events/route.ts` | GET    |
| `/api/last-updated/map`    | `src/app/api/last-updated/map/route.ts`    | GET    |

## File Size Analysis

### Largest Source Files

| File                       | Size  | Notes                     |
| -------------------------- | ----- | ------------------------- |
| `src/app/globals.css`      | 27 KB | WebFlow migration styles  |
| `src/app/page.tsx`         | 14 KB | Home page (many sections) |
| `src/app/map/page.tsx`     | 13 KB | Map page with filters     |
| `src/app/map/D3Map.tsx`    | 13 KB | D3.js visualization       |
| `src/app/api/map/route.ts` | 5 KB  | Airtable API integration  |

### Configuration Files

| File                 | Purpose                     |
| -------------------- | --------------------------- |
| `package.json`       | Dependencies, scripts       |
| `tsconfig.json`      | TypeScript compiler options |
| `eslint.config.mjs`  | Linting rules               |
| `postcss.config.mjs` | PostCSS/Tailwind setup      |
| `.prettierrc.json`   | Code formatting rules       |
| `next.config.ts`     | Next.js configuration       |

## Pages Not Yet Implemented

Based on Navigation component, these routes are referenced but pages don't exist yet:

| Route             | Referenced In    | Status          |
| ----------------- | ---------------- | --------------- |
| `/communities`    | Navigation, Home | Not implemented |
| `/self-study`     | Navigation, Home | Not implemented |
| `/jobs`           | Navigation, Home | Not implemented |
| `/funding`        | Navigation, Home | Not implemented |
| `/advisors`       | Home             | Not implemented |
| `/projects`       | Home             | Not implemented |
| `/donation-guide` | Home             | Not implemented |
| `/media-channels` | Home             | Not implemented |
| `/about`          | Footer           | Not implemented |
| `/feedback`       | Footer           | Not implemented |
