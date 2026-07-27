// Shared, dependency-free helper for tagging a resource-page listing with the
// slot it sits in, so a click can be stamped with the rank that produced it.
// Kept in its own module (no server-only imports) so client components can use
// it without pulling Airtable/Node code into the browser bundle.

/** A listing that may be one of the two featured cards on a resource page. */
interface Placeable {
  id: string
  featured?: '1' | '2' | null
}

/** Each listing's slot on its page, keyed by record id: the two featured cards
 *  (if the page has them) are 'F1'/'F2'; everything else is numbered '1', '2',
 *  '3'… in display order. Pages without featured cards just get the numbered
 *  list. Pass items in the order they render so the slot matches what the
 *  visitor saw. */
export function placementsById(items: Placeable[]): Map<string, string> {
  const placements = new Map<string, string>()
  let n = 0
  for (const item of items) {
    if (item.featured === '1') placements.set(item.id, 'F1')
    else if (item.featured === '2') placements.set(item.id, 'F2')
    else {
      n += 1
      placements.set(item.id, String(n))
    }
  }
  return placements
}
