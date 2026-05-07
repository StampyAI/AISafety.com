import type { Catalog, CitationRef } from './types'

const CITATION_REGEX = /\[\[id:([a-z][a-z-]*:rec[A-Za-z0-9]+)\]\]/g

export function extractCitations(
  text: string,
  catalog: Catalog
): CitationRef[] {
  const ids = new Set<string>()
  let match: RegExpExecArray | null
  CITATION_REGEX.lastIndex = 0
  while ((match = CITATION_REGEX.exec(text)) !== null) {
    ids.add(match[1])
  }
  if (ids.size === 0) return []
  const byId = new Map(catalog.listings.map(l => [l.id, l]))
  const refs: CitationRef[] = []
  for (const id of ids) {
    const listing = byId.get(id)
    if (!listing) continue
    refs.push({
      id: listing.id,
      type: listing.type,
      name: listing.name,
      organization: listing.organization,
      logo: listing.logo,
      url: listing.url,
      pageUrl: listing.pageUrl,
      description: listing.description,
      meta: listing.meta,
    })
  }
  return refs
}
