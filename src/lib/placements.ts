// Shared, dependency-free helper for tagging a resource-page listing with the
// slot it sits in, so a click can be stamped with the rank that produced it.
// Kept in its own module (no server-only imports) so client components can use
// it without pulling Airtable/Node code into the browser bundle.

/** A listing that may be one of the two featured cards on a resource page. */
interface Placeable {
  id: string
  featured?: string | number | null
}

/** Slot label for a card in the featured row: 'F<rank>' for a queued entry,
 *  'F-random' for a random stand-in that has no rank. */
export function featuredSlot(item: Placeable): string {
  return item.featured != null ? `F${item.featured}` : 'F-random'
}

/** Each listing's slot on its page, keyed by record id: the featured cards
 *  (if the page has them) are 'F<rank>'; everything else is numbered '1', '2',
 *  '3'… in display order. Pages without featured cards just get the numbered
 *  list. Pass items in the order they render so the slot matches what the
 *  visitor saw.
 *
 *  Pages with a featured queue (/events, /training) pass `featuredIds` — the
 *  records their queue actually displays — since a queued backup (rank 3+)
 *  renders as a normal grid card and must get a grid number, not an F-slot.
 *  Without `featuredIds`, ranks 1 and 2 count as featured (the fixed-slot
 *  pages). */
export function placementsById(
  items: Placeable[],
  featuredIds?: Set<string>
): Map<string, string> {
  const placements = new Map<string, string>()
  let n = 0
  for (const item of items) {
    const isFeaturedCard = featuredIds
      ? featuredIds.has(item.id)
      : item.featured === '1' || item.featured === '2'
    if (isFeaturedCard) placements.set(item.id, featuredSlot(item))
    else {
      n += 1
      placements.set(item.id, String(n))
    }
  }
  return placements
}
