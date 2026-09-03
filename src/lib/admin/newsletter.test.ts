import { describe, expect, it } from 'vitest'
import { contentDigest, formatLocal } from './newsletter'

// Fixtures generated with the pipeline's own function
// (~/Newsletter/ac.py content_digest) on 3 September 2026. The two sides
// MUST agree, or every draft would fail verification on the admin page.
describe('contentDigest (mirrors ac.py)', () => {
  it('matches the pipeline for plain content', () => {
    expect(contentDigest('plain')).toBe('a116c9ed46d62077')
  })
  it('ignores the marker itself and the trailing newline AC adds', () => {
    expect(
      contentDigest('<!--aisafety-issue:0000000000000000--><p>x &amp; y</p>\n')
    ).toBe('941b23541f13318e')
  })
  it('treats &amp; at any escaping depth as & (AC decodes one level per save)', () => {
    expect(contentDigest('<p>a &amp; b</p>')).toBe('a47ca84b5587983a')
    expect(contentDigest('<p>a &amp;amp; b</p>\n\n')).toBe('a47ca84b5587983a')
  })
  it('changes when the content changes', () => {
    expect(contentDigest('<p>a &amp; c</p>')).not.toBe('a47ca84b5587983a')
  })
})

describe('formatLocal', () => {
  it('renders the instant in the account offset, AC v1 sdate format', () => {
    const at = new Date('2026-09-03T11:44:54Z')
    expect(formatLocal(at, '-05:00')).toBe('2026-09-03 06:44:54')
    expect(formatLocal(at, '+00:00')).toBe('2026-09-03 11:44:54')
    expect(formatLocal(at, '+05:30')).toBe('2026-09-03 17:14:54')
  })
  it('crosses the date line correctly', () => {
    expect(formatLocal(new Date('2026-09-03T02:10:00Z'), '-05:00')).toBe(
      '2026-09-02 21:10:00'
    )
  })
})
