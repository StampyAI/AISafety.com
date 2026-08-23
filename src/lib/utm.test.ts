import { describe, expect, it } from 'vitest'
import { withUtm } from './utm'

describe('withUtm', () => {
  it('tags a plain external URL', () => {
    expect(withUtm('https://example.org/jobs', 'Jobs')).toBe(
      'https://example.org/jobs?utm_source=aisafety.com&utm_medium=referral&utm_campaign=jobs'
    )
  })

  it('hyphenates multi-word page names in utm_campaign', () => {
    expect(withUtm('https://example.org/', 'Media channels')).toContain(
      'utm_campaign=media-channels'
    )
    expect(withUtm('https://example.org/', 'Donation guide')).toContain(
      'utm_campaign=donation-guide'
    )
  })

  it('appends to an existing query string instead of clobbering it', () => {
    expect(withUtm('https://example.org/apply?id=42', 'Funding')).toBe(
      'https://example.org/apply?id=42&utm_source=aisafety.com&utm_medium=referral&utm_campaign=funding'
    )
  })

  it('keeps the #fragment after the query', () => {
    const tagged = withUtm('https://example.org/page#section', 'Events')
    expect(tagged).toBe(
      'https://example.org/page?utm_source=aisafety.com&utm_medium=referral&utm_campaign=events#section'
    )
  })

  it("replaces a stored URL's own utm_ tags with ours", () => {
    const tagged = withUtm(
      'https://example.org/?utm_source=twitter&utm_content=ad&ref=keepme',
      'Training'
    )
    expect(tagged).toContain('ref=keepme')
    expect(tagged).toContain('utm_source=aisafety.com')
    expect(tagged).not.toContain('twitter')
    expect(tagged).not.toContain('utm_content')
  })

  it('leaves internal links, relative paths, and other schemes untouched', () => {
    expect(withUtm('https://aisafety.com/events', 'Home')).toBe(
      'https://aisafety.com/events'
    )
    expect(withUtm('https://www.aisafety.com/', 'Home')).toBe(
      'https://www.aisafety.com/'
    )
    expect(withUtm('/events', 'Home')).toBe('/events')
    expect(withUtm('#', 'Communities')).toBe('#')
    expect(withUtm('mailto:hello@example.org', 'Advisors')).toBe(
      'mailto:hello@example.org'
    )
  })
})
