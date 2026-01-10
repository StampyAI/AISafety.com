---
title: Development Guide
description: Setup instructions, workflow, and coding standards
generated: 2026-01-10
---

# AISafety.com - Development Guide

## Prerequisites

| Requirement | Version      | Notes                          |
| ----------- | ------------ | ------------------------------ |
| Node.js     | See `.nvmrc` | Use nvm for version management |
| npm         | Latest       | Comes with Node.js             |
| Git         | Latest       | For version control            |

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd AISafety.com

# Use correct Node version (if using nvm)
nvm use

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Airtable credentials

# Start development server
npm run dev

# Open http://localhost:3000
```

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the project root:

```bash
# Airtable Configuration
AIRTABLE_TOKEN=your_personal_access_token_here
AIRTABLE_BASE_ID=your_base_id_here
```

### Getting Airtable Credentials

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Create a new Personal Access Token
3. Grant access to the AISafety.com base
4. Copy the token to `AIRTABLE_TOKEN`
5. Find Base ID in the Airtable URL: `airtable.com/{BASE_ID}/...`

## Available Scripts

| Script       | Command                | Description                      |
| ------------ | ---------------------- | -------------------------------- |
| Development  | `npm run dev`          | Start dev server with hot reload |
| Build        | `npm run build`        | Create production build          |
| Start        | `npm start`            | Start production server          |
| Lint         | `npm run lint`         | Run ESLint                       |
| Lint Fix     | `npm run lint:fix`     | Auto-fix ESLint issues           |
| Format       | `npm run format`       | Format code with Prettier        |
| Format Check | `npm run format:check` | Check formatting                 |
| Type Check   | `npm run type-check`   | Run TypeScript compiler          |

## Development Workflow

### 1. Before Starting Work

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Start development server
npm run dev
```

### 2. While Developing

- Make changes to files in `src/`
- Hot reload will update the browser automatically
- Check terminal for TypeScript errors
- Check browser console for runtime errors

### 3. Before Committing

The project uses Husky pre-commit hooks that automatically run:

- ESLint with auto-fix
- Prettier formatting

This happens automatically when you run `git commit`.

### 4. Manual Quality Checks

```bash
# Run all checks manually
npm run lint
npm run type-check
npm run format:check
```

## Project Structure Guidelines

### Adding a New Page

1. Create folder in `src/app/` matching the URL path
2. Add `page.tsx` inside the folder
3. Optionally add `layout.tsx` for page-specific layout

```bash
# Example: Adding /about page
mkdir src/app/about
touch src/app/about/page.tsx
```

```tsx
// src/app/about/page.tsx
export const metadata = {
  title: 'About – AISafety.com',
  description: 'About the AI Safety community',
}

export default function AboutPage() {
  return (
    <div className="content-container">
      <h1 className="page-title">About</h1>
      {/* Page content */}
    </div>
  )
}
```

### Adding a New Component

1. Create file in `src/components/`
2. Use PascalCase naming
3. Export as default

```tsx
// src/components/MyComponent.tsx
interface MyComponentProps {
  title: string
}

export default function MyComponent({ title }: MyComponentProps) {
  return <div>{title}</div>
}
```

### Adding an API Route

1. Create folder in `src/app/api/` matching the URL path
2. Add `route.ts` inside the folder
3. Export HTTP method handlers (GET, POST, etc.)

```tsx
// src/app/api/example/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Hello' })
}
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new files
- Prefer type inference over explicit types
- Define interfaces for component props
- Use `interface` for object shapes, `type` for unions/aliases

### React Components

- Use function components with hooks
- Prefer Server Components (default) unless client-side interactivity needed
- Add `'use client'` directive only when necessary
- Use `next/image` for images, `next/link` for internal links

### CSS

- Use existing utility classes from `globals.css`
- Add Tailwind classes for layout/spacing
- Create CSS Modules for component-specific styles
- Preserve WebFlow class names where possible

### Imports

```tsx
// Order: React/Next, External libs, Internal modules, Styles
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import * as d3 from 'd3'
import MyComponent from '@/components/MyComponent'
import styles from './page.module.css'
```

## Debugging

### Common Issues

**1. Airtable API errors**

- Check `.env.local` has correct credentials
- Verify token has access to the base
- Check Airtable API rate limits

**2. D3 Map not rendering**

- Ensure dynamic import with `ssr: false`
- Check browser console for D3 errors
- Verify `orgs` array has data with coordinates

**3. Styles not applying**

- Clear `.next` cache: `rm -rf .next`
- Check class name spelling
- Verify Tailwind classes in `globals.css`

### Debugging Tools

```bash
# Clear Next.js cache
rm -rf .next

# Check TypeScript errors
npm run type-check

# Check for lint errors
npm run lint

# View production build locally
npm run build && npm start
```

## Testing

Currently no test framework is configured. When adding tests:

1. Install testing dependencies
2. Add test scripts to `package.json`
3. Create `__tests__` folders or `.test.tsx` files

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

### Manual Build

```bash
# Create production build
npm run build

# Start production server
npm start
```

### Environment Variables in Production

Set these in your hosting platform:

- `AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID`

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [D3.js Documentation](https://d3js.org)
- [Airtable API Documentation](https://airtable.com/developers/web/api)
