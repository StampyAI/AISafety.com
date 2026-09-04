import { describe, expect, it } from 'vitest'
import {
  ACCESS_AREAS,
  ACCESS_KEYS,
  accessFrom,
  ALL_ACCESS,
  DEFAULT_NEW_ACCESS,
  hasAnyAccess,
  NO_ACCESS,
  parseAccess,
} from './access'
import {
  findAdminUser,
  isRootAdmin,
  ROOT_ADMINS,
  validateUserInput,
} from './users'

describe('access flags', () => {
  it('lists every area once with a tab href', () => {
    expect(new Set(ACCESS_KEYS).size).toBe(ACCESS_KEYS.length)
    for (const a of ACCESS_AREAS) expect(a.href).toMatch(/^\/admin\//)
  })

  it('builds flags from keys', () => {
    expect(accessFrom(['analytics']).analytics).toBe(true)
    expect(accessFrom(['analytics']).newsletter).toBe(false)
    expect(hasAnyAccess(ALL_ACCESS)).toBe(true)
    expect(hasAnyAccess(NO_ACCESS)).toBe(false)
  })

  it('keeps the writing, sending and granting areas out of the default', () => {
    expect(DEFAULT_NEW_ACCESS.mapEditor).toBe(false)
    expect(DEFAULT_NEW_ACCESS.newsletter).toBe(false)
    expect(DEFAULT_NEW_ACCESS.manageUsers).toBe(false)
    expect(DEFAULT_NEW_ACCESS.playground).toBe(true)
  })

  it('parses untrusted input strictly', () => {
    expect(
      parseAccess({ analytics: true, bogus: true, newsletter: 'yes' })
    ).toEqual(accessFrom(['analytics']))
    expect(parseAccess(null)).toBeNull()
    expect(parseAccess('x')).toBeNull()
  })
})

describe('ROOT_ADMINS / findAdminUser', () => {
  it('lists every root email once, lower-case, with full access', () => {
    const emails = ROOT_ADMINS.map(u => u.email)
    expect(new Set(emails).size).toBe(emails.length)
    for (const u of ROOT_ADMINS) {
      expect(u.email).toBe(u.email.trim().toLowerCase())
      expect(u.access).toEqual(ALL_ACCESS)
    }
  })

  it('finds root admins case-insensitively without the store', async () => {
    const first = ROOT_ADMINS[0]
    expect((await findAdminUser(first.email.toUpperCase()))?.email).toBe(
      first.email
    )
    expect(isRootAdmin(` ${first.email} `)).toBe(true)
  })

  it('returns null for anyone unknown', async () => {
    expect(await findAdminUser('nobody@example.invalid')).toBeNull()
    expect(await findAdminUser('')).toBeNull()
  })
})

describe('validateUserInput', () => {
  it('accepts an email plus tabs and lower-cases the email', () => {
    expect(
      validateUserInput({
        email: ' Someone@Example.com ',
        access: { analytics: true },
      })
    ).toEqual({
      ok: true,
      value: {
        email: 'someone@example.com',
        access: accessFrom(['analytics']),
      },
    })
  })

  it('rejects bad emails, no tabs and root emails', () => {
    const bad = [
      { email: 'not-an-email', access: { analytics: true } },
      { email: 'a@b.c', access: {} },
      { email: 'a@b.c', access: 'all' },
      { email: ROOT_ADMINS[0].email, access: { analytics: true } },
      null,
      'string',
    ]
    for (const input of bad) expect(validateUserInput(input).ok).toBe(false)
  })
})
