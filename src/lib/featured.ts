// Featured queue. The Featured field in Airtable holds a rank (1, 2, 3, …):
// the page shows the two lowest-ranked entries that are still live, so ranks
// 3+ are curated backups that step in automatically when a slot expires.
// A daily local job (~/featured-queue on Bryce's Mac) clears the rank of
// records that have left the page and shifts the rest up, so the numbers in
// Airtable stay small and gapless.

/** Airtable single-select rank ("1", "2", …) → number, or null. */
export function parseFeaturedRank(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  return Number(value)
}

/**
 * Pick the (up to) two queue entries a page should display, in rank order.
 *
 * When `isOpen` is given (the /training page), entries whose applications
 * have closed are passed over while an open backup exists further down the
 * queue — but a closed entry still fills a slot when there is no better
 * candidate, so the row keeps two cards for as long as the queue allows.
 */
export function selectFeatured<T extends { featured: number | null }>(
  items: T[],
  isOpen?: (item: T) => boolean
): T[] {
  const queue = items
    .filter(item => item.featured != null)
    .sort((a, b) => a.featured! - b.featured!)
  const picked = (isOpen ? queue.filter(isOpen) : queue).slice(0, 2)
  for (const item of queue) {
    if (picked.length >= 2) break
    if (!picked.includes(item)) picked.push(item)
  }
  return picked.sort((a, b) => a.featured! - b.featured!)
}
