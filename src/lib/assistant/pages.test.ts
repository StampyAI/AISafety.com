import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CHIPS,
  DEFAULT_GREETING,
  chipsFor,
  findPage,
  greetingFor,
} from './pages'

describe('findPage', () => {
  it('matches the homepage', () => {
    expect(findPage('/')?.path).toBe('/')
  })

  it("folds Vercel's '/index' alias into the homepage", () => {
    // ISR revalidations on Vercel render the root route as '/index' while
    // the browser hydrates with '/' — both must resolve to the same page or
    // the assistant chips mismatch and hydration fails (React #418).
    expect(findPage('/index')?.path).toBe('/')
    expect(chipsFor('/index')).toEqual(chipsFor('/'))
    expect(greetingFor('/index')).toEqual(greetingFor('/'))
    expect(chipsFor('/index')).not.toEqual(DEFAULT_CHIPS)
  })

  it('matches exact paths and subpaths', () => {
    expect(findPage('/jobs')?.path).toBe('/jobs')
    expect(findPage('/events?view=online')?.path).toBe('/events')
    expect(findPage('/hackathon/details')?.path).toBe('/hackathon')
  })

  it('falls back to defaults for unknown paths', () => {
    expect(findPage('/no-such-page')).toBeUndefined()
    expect(chipsFor('/no-such-page')).toEqual(DEFAULT_CHIPS)
    expect(greetingFor('/no-such-page')).toEqual(DEFAULT_GREETING)
  })
})
