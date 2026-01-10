---
title: Project Documentation Index
description: Primary entry point for AI-assisted development documentation
generated: 2026-01-10
---

# AISafety.com - Project Documentation Index

> **Primary entry point for AI-assisted development**
>
> This documentation provides comprehensive reference material for understanding, maintaining, and extending the AISafety.com codebase.

## Project Overview

| Attribute            | Value                           |
| -------------------- | ------------------------------- |
| **Type**             | Monolith (single codebase)      |
| **Primary Language** | TypeScript                      |
| **Framework**        | Next.js 16 (App Router)         |
| **Architecture**     | Component-based with App Router |

## Quick Reference

| Category        | Details                                                  |
| --------------- | -------------------------------------------------------- |
| **Tech Stack**  | Next.js 16, React 19, TypeScript, Tailwind CSS v4, D3.js |
| **Entry Point** | `src/app/layout.tsx`                                     |
| **Data Source** | Airtable API                                             |
| **Deployment**  | Vercel                                                   |

## Generated Documentation

### Core Documentation

- [Project Overview](./project-overview.md) - Executive summary, purpose, and quick start
- [Architecture](./architecture.md) - System design, patterns, and data flow
- [Source Tree Analysis](./source-tree-analysis.md) - Directory structure and file purposes

### Technical Reference

- [API Contracts](./api-contracts.md) - API endpoints, request/response schemas
- [Component Inventory](./component-inventory.md) - React components and their usage
- [Development Guide](./development-guide.md) - Setup, workflow, and coding standards

### Project Metadata

- [Scan Report](./project-scan-report.json) - Workflow state and findings (JSON)

## Existing Documentation

| File                      | Description                   |
| ------------------------- | ----------------------------- |
| [README.md](../README.md) | Basic setup instructions      |
| [CLAUDE.md](../CLAUDE.md) | AI assistant coding standards |

## Getting Started

### For New Developers

1. Read [Project Overview](./project-overview.md) for context
2. Follow [Development Guide](./development-guide.md) for setup
3. Review [Architecture](./architecture.md) for system understanding
4. Check [Component Inventory](./component-inventory.md) for UI patterns

### For Feature Development

1. Review [Architecture](./architecture.md) for patterns to follow
2. Check [Source Tree](./source-tree-analysis.md) for file locations
3. See [API Contracts](./api-contracts.md) for data fetching patterns
4. Follow [Development Guide](./development-guide.md) coding standards

### For AI-Assisted Development

When creating a PRD or planning features, reference:

- This index for navigation
- [Architecture](./architecture.md) for technical constraints
- [Component Inventory](./component-inventory.md) for reusable patterns
- [API Contracts](./api-contracts.md) for data integration

## Key Files Quick Reference

### Pages

| Route                  | File                                   | Status          |
| ---------------------- | -------------------------------------- | --------------- |
| `/`                    | `src/app/page.tsx`                     | Implemented     |
| `/map`                 | `src/app/map/page.tsx`                 | Implemented     |
| `/events-and-training` | `src/app/events-and-training/page.tsx` | Implemented     |
| `/communities`         | -                                      | Not implemented |
| `/self-study`          | -                                      | Not implemented |
| `/jobs`                | -                                      | Not implemented |
| `/funding`             | -                                      | Not implemented |

### API Endpoints

| Endpoint                   | File                                       |
| -------------------------- | ------------------------------------------ |
| `/api/map`                 | `src/app/api/map/route.ts`                 |
| `/api/last-updated/events` | `src/app/api/last-updated/events/route.ts` |
| `/api/last-updated/map`    | `src/app/api/last-updated/map/route.ts`    |

### Shared Components

| Component   | File                             |
| ----------- | -------------------------------- |
| Navigation  | `src/components/Navigation.tsx`  |
| Footer      | `src/components/Footer.tsx`      |
| LastUpdated | `src/components/LastUpdated.tsx` |
| UpButton    | `src/components/UpButton.tsx`    |

## Environment Variables

| Variable           | Required | Description                    |
| ------------------ | -------- | ------------------------------ |
| `AIRTABLE_TOKEN`   | Yes      | Airtable Personal Access Token |
| `AIRTABLE_BASE_ID` | Yes      | Airtable Base identifier       |

## Commands

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run lint       # Run linter
npm run type-check # TypeScript check
npm run format     # Format code
```
