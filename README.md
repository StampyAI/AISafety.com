# AI Safety Website

This is the Next.js implementation of aisafety.com, migrated from WebFlow. The site serves as a resource hub for the AI Safety community, providing curated lists of events, communities, courses, jobs, funding opportunities, and an interactive ecosystem map of organizations working on AI existential safety.

## Documentation

For comprehensive documentation, see the [docs/](./docs/) directory:

- [Project Overview](./docs/project-overview.md) - Executive summary and quick start
- [Architecture](./docs/architecture.md) - System design and data flow
- [Source Tree](./docs/source-tree-analysis.md) - Directory structure guide
- [API Contracts](./docs/api-contracts.md) - API endpoints and schemas
- [Component Inventory](./docs/component-inventory.md) - React components reference
- [Development Guide](./docs/development-guide.md) - Full setup and coding standards

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Environment Variables

Create a `.env.local` file with your Airtable credentials:

```
AIRTABLE_TOKEN=your_personal_access_token_here
AIRTABLE_BASE_ID=your_base_id_here
```

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Airtable** - Data source
- **ESLint + Prettier** - Code quality and formatting
- **Husky** - Git hooks for pre-commit checks

## Deployment

Deploy to Vercel for automatic builds and deployments from git pushes.
