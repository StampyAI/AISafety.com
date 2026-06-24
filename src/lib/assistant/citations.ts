import type { Catalog, CitationRef, Listing } from './types'

const CITATION_REGEX = /\[\[id:([a-z][a-z-]*:rec[A-Za-z0-9]+)\]\]/g

// Mirrors the tolerant [[card:...]] grammar the renderer and the log snapshot
// use (route.ts): bare rec id, doubled prefix, and whitespace are all allowed.
const CARD_ID_REGEX =
  /\[\[\s*card\s*:\s*([^\]|\n]+?)(?:\s*\|[^\]\n]*)?\s*\]\]/gi

function toRef(l: Listing): CitationRef {
  return {
    id: l.id,
    type: l.type,
    name: l.name,
    organization: l.organization,
    logo: l.logo,
    url: l.url,
    pageUrl: l.pageUrl,
    description: l.description,
    meta: l.meta,
  }
}

const recOf = (id: string): string | undefined =>
  id.match(/rec[A-Za-z0-9]+$/)?.[0]

/** Resolve a (possibly bare or doubled-prefix) listing id against a lookup,
 *  falling back to a suffix match on the underlying rec id — the same tolerance
 *  as the renderer's resolveCitation. */
function resolveBy<T>(
  rawId: string,
  byId: Map<string, T>,
  byRec: Map<string, T>
): T | undefined {
  const direct = byId.get(rawId)
  if (direct) return direct
  const rec = recOf(rawId)
  return rec ? byRec.get(rec) : undefined
}

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
    refs.push(toRef(listing))
  }
  return refs
}

/** Audits the `[[card:...]]` ids the model wrote against what's already cited
 *  (tool results + `[[id:]]` markers) and the full catalog. Returns:
 *  - `backfill`: catalog listings for ids that name a REAL listing the model
 *    never surfaced via a tool this turn, so the stored citation snapshot can
 *    still carry them (and the admin/log render the real card).
 *  - `fabricated`: ids that resolve to NOTHING anywhere — the model invented
 *    them. The caller logs these; the live renderer degrades them to a "Browse
 *    X" link and the admin flags them UNRESOLVED.
 *  Pure — does not mutate its inputs. */
export function auditCardCitations(
  text: string,
  cited: CitationRef[],
  catalog: Catalog
): { backfill: CitationRef[]; fabricated: string[] } {
  const cardIds = new Set<string>()
  let m: RegExpExecArray | null
  CARD_ID_REGEX.lastIndex = 0
  while ((m = CARD_ID_REGEX.exec(text)) !== null) {
    cardIds.add(m[1].replace(/\s+/g, ''))
  }
  if (cardIds.size === 0) return { backfill: [], fabricated: [] }

  const citedById = new Map(cited.map(c => [c.id, c]))
  const citedByRec = new Map<string, CitationRef>()
  for (const c of cited) {
    const r = recOf(c.id)
    if (r) citedByRec.set(r, c)
  }
  const catById = new Map(catalog.listings.map(l => [l.id, l]))
  const catByRec = new Map<string, Listing>()
  for (const l of catalog.listings) {
    const r = recOf(l.id)
    if (r) catByRec.set(r, l)
  }

  const backfill: CitationRef[] = []
  const fabricated: string[] = []
  for (const id of cardIds) {
    if (resolveBy(id, citedById, citedByRec)) continue // already cited
    const listing = resolveBy(id, catById, catByRec)
    if (listing) backfill.push(toRef(listing))
    else fabricated.push(id)
  }
  return { backfill, fabricated }
}
