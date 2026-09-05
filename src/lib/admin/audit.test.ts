import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { AUDIT_KEEP, createAuditStore } from './audit'

const dir = mkdtempSync(path.join(tmpdir(), 'admin-audit-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('audit store (file backend)', () => {
  const store = createAuditStore({ file: path.join(dir, 'audit.json') })

  it('records events newest first with a timestamp', async () => {
    await store.record({
      kind: 'sign-in',
      actor: 'Bryce',
      at: '2026-09-05T10:00:00.000Z',
    })
    await store.record({
      kind: 'approved',
      actor: 'Bryce',
      subject: 'a@example.com',
      detail: 'Analytics',
    })
    const events = await store.recent()
    expect(events).toHaveLength(2)
    expect(events[0].kind).toBe('approved')
    expect(events[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(events[1]).toEqual({
      at: '2026-09-05T10:00:00.000Z',
      kind: 'sign-in',
      actor: 'Bryce',
    })
  })

  it('honours the limit and the cap', async () => {
    expect(await store.recent(1)).toHaveLength(1)
    const big = createAuditStore({ file: path.join(dir, 'big.json') })
    for (let i = 0; i < AUDIT_KEEP + 5; i++) {
      await big.record({ kind: 'sign-in', actor: `p${i}` })
    }
    expect((await big.recent(AUDIT_KEEP + 10)).length).toBe(AUDIT_KEEP)
  })

  it('survives a missing file', async () => {
    const empty = createAuditStore({
      file: path.join(dir, 'nope', 'audit.json'),
    })
    expect(await empty.recent()).toEqual([])
  })
})
