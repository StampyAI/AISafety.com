// Featured queue. The Featured field in Airtable holds a rank (1, 2, 3, …):
// the page shows the two lowest-ranked entries that are still live with open
// applications, so ranks 3+ are curated backups that step in automatically
// when a slot expires. A daily local job (~/featured-queue on Bryce's Mac)
// clears the rank of records that have left the page or whose deadline has
// passed, and shifts the rest up, so the numbers in Airtable stay small and
// gapless. When the queue can't fill both slots, the page tops the row up
// with random stand-ins via withRandomStandIns().

/** Airtable single-select rank ("1", "2", …) → number, or null. */
export function parseFeaturedRank(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  return Number(value)
}

/**
 * Pick the (up to) two queue entries a page should display, in rank order.
 * When `isOpen` is given, entries whose applications have closed are never
 * shown — an "Apply by <past date>" featured card helps nobody.
 */
export function selectFeatured<T extends { featured: number | null }>(
  items: T[],
  isOpen?: (item: T) => boolean
): T[] {
  const queue = items
    .filter(item => item.featured != null)
    .sort((a, b) => a.featured! - b.featured!)
  return (isOpen ? queue.filter(isOpen) : queue).slice(0, 2)
}

/**
 * Top the featured row back up to two cards with random stand-ins from the
 * page's own listings when the curated queue can't fill both slots.
 * Open-applications listings are preferred; only when none are left does a
 * closed one stand in, so the row keeps two cards whenever the page has two
 * listings at all.
 *
 * The pick is seeded from the pool's record ids, not Math.random(), so the
 * server-rendered HTML and the browser hydrate to the same choice; it
 * reshuffles when the page's data refreshes rather than on every view.
 */
export function withRandomStandIns<T extends { id: string }>(
  picked: T[],
  pool: T[],
  isOpen?: (item: T) => boolean
): T[] {
  if (picked.length >= 2) return picked
  const chosen = new Set(picked.map(item => item.id))
  const rest = pool.filter(item => !chosen.has(item.id))
  const tiers = isOpen
    ? [rest.filter(isOpen), rest.filter(item => !isOpen(item))]
    : [rest]
  const result = [...picked]
  let seed = hashIds(pool)
  for (const tier of tiers) {
    const remaining = [...tier]
    while (result.length < 2 && remaining.length > 0) {
      seed = nextSeed(seed)
      result.push(remaining.splice(seed % remaining.length, 1)[0])
    }
  }
  return result
}

// FNV-1a over the pool's record ids — a stable seed shared by server and
// client so hydration agrees on the pick.
function hashIds(items: Array<{ id: string }>): number {
  let h = 0x811c9dc5
  for (const { id } of items) {
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  return h >>> 0
}

// One mulberry32 step: a deterministic, well-mixed successor seed.
function nextSeed(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (t ^ (t >>> 14)) >>> 0
}
