// Per-tab singleton: page client components publish their state here so the
// assistant can include it as ambient context. Lives in module scope so it
// survives across route changes (one instance per tab).

export interface PublishedPageContext {
  page: string
  filters?: Record<string, unknown>
  search?: string
}

let current: PublishedPageContext | null = null

export function setPageContext(ctx: PublishedPageContext | null): void {
  current = ctx
}

export function getPageContext(): PublishedPageContext | null {
  return current
}
