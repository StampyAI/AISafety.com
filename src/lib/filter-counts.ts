// Shared machinery for the resource pages' filter sidebars. Each page
// declares its filter groups once; the same declaration then drives both
// the visible list and the sidebar counts.
//
// Counts are "live": a group's numbers are computed over the items that
// pass the search box and every OTHER group, ignoring the group's own
// ticks — so each number answers "what would I get if I also ticked
// this?", and ticking one option never zeroes out its siblings.

export interface FilterGroupSpec<T> {
  selected: string[]
  matches: (item: T, value: string) => boolean
}

/**
 * Items that pass `base` (search plus any always-on conditions) and every
 * group's selections. Pass `skip` to leave one group's selections out —
 * used to compute that group's counts.
 */
export function filterItems<T>(
  items: T[],
  base: (item: T) => boolean,
  groups: Record<string, FilterGroupSpec<T>>,
  skip?: string
): T[] {
  return items.filter(item => {
    if (!base(item)) return false
    for (const [key, group] of Object.entries(groups)) {
      if (key === skip || group.selected.length === 0) continue
      if (!group.selected.some(value => group.matches(item, value))) {
        return false
      }
    }
    return true
  })
}

/** How many of `items` match each option. */
export function optionCounts<T>(
  items: T[],
  options: string[],
  matches: (item: T, value: string) => boolean
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    for (const option of options) {
      if (matches(item, option)) {
        counts[option] = (counts[option] || 0) + 1
      }
    }
  }
  return counts
}
