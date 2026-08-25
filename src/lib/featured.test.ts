import { describe, expect, it } from 'vitest'
import { selectFeatured, withRandomStandIns } from './featured'

interface Item {
  id: string
  featured: number | null
  open: boolean
}

function item(id: string, featured: number | null, open = true): Item {
  return { id, featured, open }
}

const isOpen = (i: Item) => i.open

describe('selectFeatured', () => {
  it('picks the two lowest-ranked entries in rank order', () => {
    const items = [item('c', 3), item('a', 1), item('b', 2), item('x', null)]
    expect(selectFeatured(items).map(i => i.id)).toEqual(['a', 'b'])
  })

  it('never shows closed entries, even when nothing open is queued behind', () => {
    const items = [item('a', 1), item('b', 2, false), item('c', 3, false)]
    expect(selectFeatured(items, isOpen).map(i => i.id)).toEqual(['a'])
  })

  it('lets an open backup step over a closed entry', () => {
    const items = [item('a', 1), item('b', 2, false), item('c', 3)]
    expect(selectFeatured(items, isOpen).map(i => i.id)).toEqual(['a', 'c'])
  })
})

describe('withRandomStandIns', () => {
  const pool = [
    item('a', 1),
    item('b', null),
    item('c', null),
    item('d', null, false),
  ]

  it('leaves a full row alone', () => {
    const picked = [item('a', 1), item('e', 2)]
    expect(withRandomStandIns(picked, pool, isOpen)).toEqual(picked)
  })

  it('tops the row up to two cards without repeating a pick', () => {
    const picked = selectFeatured(pool, isOpen)
    const result = withRandomStandIns(picked, pool, isOpen)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('a')
    expect(['b', 'c']).toContain(result[1].id)
  })

  it('prefers open listings and only uses closed ones as a last resort', () => {
    const closedHeavy = [item('a', null, false), item('b', null)]
    const result = withRandomStandIns([], closedHeavy, isOpen)
    expect(result.map(i => i.id).sort()).toEqual(['a', 'b'])
    expect(result[0].id).toBe('b')
  })

  it('is deterministic for the same pool, so hydration agrees with the server', () => {
    const first = withRandomStandIns([], pool, isOpen)
    const second = withRandomStandIns([], pool, isOpen)
    expect(first).toEqual(second)
  })
})
