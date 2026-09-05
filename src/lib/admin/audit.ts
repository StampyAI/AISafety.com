// The admin's activity trail: who signed in, who asked for access, who was
// approved or removed, who changed whose tabs, who sent a newsletter. Kept as
// a capped list in the same Upstash Redis as the user list (or a JSON file on
// a laptop without Redis) and shown on the Admin admin page. Best effort —
// a failure to log never fails the action being logged.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Redis } from '@upstash/redis'

export type AuditKind =
  | 'sign-in'
  | 'access-requested'
  | 'approved'
  | 'added'
  | 'access-changed'
  | 'removed'
  | 'request-dismissed'
  | 'newsletter-sent'

export interface AuditEvent {
  /** ISO timestamp. */
  at: string
  kind: AuditKind
  /** Who did it: the signed-in admin's name, or the Google email for a
   *  sign-in / request by someone not yet on the list. */
  actor: string
  /** Who or what it was done to, when that isn't the actor. */
  subject?: string
  /** Short free text, e.g. the tabs granted or the newsletter subject. */
  detail?: string
}

/** How many events are kept. Plenty for a small team's months. */
export const AUDIT_KEEP = 2000

export interface AuditStore {
  record(event: Omit<AuditEvent, 'at'> & { at?: string }): Promise<void>
  /** Newest first. */
  recent(limit?: number): Promise<AuditEvent[]>
}

const KEY = 'admin:audit'

function redisStore(db: Redis): AuditStore {
  return {
    async record(e) {
      const event: AuditEvent = { at: e.at ?? new Date().toISOString(), ...e }
      await db.lpush(KEY, JSON.stringify(event))
      await db.ltrim(KEY, 0, AUDIT_KEEP - 1)
    },
    async recent(limit = 100) {
      const raw = await db.lrange<string | AuditEvent>(KEY, 0, limit - 1)
      return raw.map(r =>
        typeof r === 'string' ? (JSON.parse(r) as AuditEvent) : r
      )
    },
  }
}

function fileStore(file: string): AuditStore {
  const read = async (): Promise<AuditEvent[]> => {
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as unknown
      return Array.isArray(parsed) ? (parsed as AuditEvent[]) : []
    } catch {
      return []
    }
  }
  return {
    async record(e) {
      const event: AuditEvent = { at: e.at ?? new Date().toISOString(), ...e }
      const list = [event, ...(await read())].slice(0, AUDIT_KEEP)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, JSON.stringify(list, null, 2), 'utf8')
    },
    async recent(limit = 100) {
      return (await read()).slice(0, limit)
    },
  }
}

export function createAuditStore(opts: {
  redis?: Redis | null
  file?: string
}): AuditStore {
  if (opts.redis) return redisStore(opts.redis)
  return fileStore(
    opts.file ?? path.join(process.cwd(), '.admin-dev', 'audit.json')
  )
}

const restUrl =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const restToken =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

const store = createAuditStore({
  redis:
    restUrl && restToken ? new Redis({ url: restUrl, token: restToken }) : null,
})

/** Record one event. Never throws. */
export async function audit(
  event: Omit<AuditEvent, 'at'> & { at?: string }
): Promise<void> {
  try {
    await store.record(event)
  } catch (err) {
    console.warn('[admin-audit] could not record event:', err)
  }
}

/** Newest first. Empty on any failure. */
export async function recentAudit(limit = 100): Promise<AuditEvent[]> {
  try {
    return await store.recent(limit)
  } catch (err) {
    console.warn('[admin-audit] could not read events:', err)
    return []
  }
}
