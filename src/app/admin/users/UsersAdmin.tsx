'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  ACCESS_AREAS,
  DEFAULT_NEW_ACCESS,
  type AccessFlags,
} from '@/lib/admin/access'
import adminStyles from '../admin.module.css'
import styles from './users.module.css'

interface Row {
  email: string
  /** Null until their first Google sign-in. */
  name: string | null
  access: AccessFlags
  builtIn: boolean
  isMe: boolean
  addedAt: string | null
  addedBy: string | null
  lastSignInAt: string | null
}

interface AccessRequest {
  email: string
  name: string | null
  firstAt: string
  lastAt: string
  count: number
}

interface AuditEvent {
  at: string
  kind: string
  actor: string
  subject?: string
  detail?: string
}

interface Payload {
  users: Row[]
  requests: AccessRequest[]
  activity: AuditEvent[]
  shared: boolean
}

/** "Bryce approved a@b.c (Analytics)" — one line per event. */
function describeEvent(e: AuditEvent): string {
  const tail = e.detail ? ` (${e.detail})` : ''
  switch (e.kind) {
    case 'sign-in':
      return `${e.actor} signed in`
    case 'access-requested':
      return `${e.actor} requested access${e.detail ? ` as ${e.detail}` : ''}`
    case 'approved':
      return `${e.actor} approved ${e.subject}${tail}`
    case 'added':
      return `${e.actor} added ${e.subject}${tail}`
    case 'access-changed':
      return `${e.actor} changed ${e.subject}'s tabs to ${e.detail || 'none'}`
    case 'removed':
      return `${e.actor} removed ${e.subject}`
    case 'request-dismissed':
      return `${e.actor} dismissed the request from ${e.subject}`
    case 'newsletter-sent':
      return `${e.actor} approved a newsletter send${tail}`
    default:
      return `${e.actor} ${e.kind}${e.subject ? ` ${e.subject}` : ''}${tail}`
  }
}

function when(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const REAUTH_URL = '/api/admin/auth/google?next=/admin/users'

/** One checkbox per tab. */
function AccessPicker({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: AccessFlags
  onChange?: (next: AccessFlags) => void
  disabled?: boolean
  idPrefix: string
}) {
  return (
    <div className={styles.picker} role="group" aria-label="Tabs">
      {ACCESS_AREAS.map(area => (
        <label key={area.key} className={styles.pick}>
          <input
            type="checkbox"
            id={`${idPrefix}-${area.key}`}
            checked={value[area.key]}
            disabled={disabled}
            onChange={e =>
              onChange?.({ ...value, [area.key]: e.target.checked })
            }
          />
          {area.label}
        </label>
      ))}
    </div>
  )
}

export default function UsersAdmin() {
  const router = useRouter()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [form, setForm] = useState<{ email: string; access: AccessFlags }>({
    email: '',
    access: DEFAULT_NEW_ACCESS,
  })
  /** Tabs ticked for each pending request before it is approved. */
  const [requestPicks, setRequestPicks] = useState<Record<string, AccessFlags>>(
    {}
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const body = (await res.json()) as Payload & { error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setData(body)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** One call to the API; a stale session bounces through Google and back. */
  async function call(
    method: 'POST' | 'PATCH' | 'DELETE',
    body: Record<string, unknown>,
    okText: string,
    url = '/api/admin/users'
  ): Promise<boolean> {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      if (res.status === 401 && payload.error === 'reauth') {
        // Changing who can sign in needs a session Google minted recently:
        // one trip through the account chooser, then straight back here.
        window.location.assign(REAUTH_URL)
        return false
      }
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`)
      setNotice({ kind: 'ok', text: okText })
      await load()
      // The tab bar is server-rendered; refresh it so the pending-request
      // badge on "Admin admin" follows what just happened.
      router.refresh()
      return true
    } catch (err) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : String(err),
      })
      // Puts back whatever an optimistic tick changed.
      await load()
      return false
    } finally {
      setBusy(false)
    }
  }

  const tabsOn = (a: AccessFlags) =>
    ACCESS_AREAS.filter(x => a[x.key]).map(x => x.label)
  const who = (u: Row) => u.name ?? u.email

  /** Tick or untick a tab for someone: shown at once, then saved. */
  function setAccess(u: Row, next: AccessFlags) {
    setData(prev =>
      prev
        ? {
            ...prev,
            users: prev.users.map(x =>
              x.email === u.email ? { ...x, access: next } : x
            ),
          }
        : prev
    )
    void call(
      'PATCH',
      { email: u.email, access: next },
      `${who(u)} now has: ${tabsOn(next).join(', ') || 'nothing'}.`
    )
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const ok = await call(
      'POST',
      form,
      `${form.email.trim().toLowerCase()} can now sign in.`
    )
    if (ok) setForm({ email: '', access: DEFAULT_NEW_ACCESS })
  }

  return (
    <div className={adminStyles.editorColumn}>
      <div className={adminStyles.pageHeading}>
        <h1 className={adminStyles.pageTitle}>Admin admin</h1>
        <p className={adminStyles.pageMeta}>
          {data ? (
            <>
              <span className={adminStyles.pageMetaValue}>
                {data.users.length}
              </span>{' '}
              {data.users.length === 1 ? 'person' : 'people'} can sign in
            </>
          ) : (
            'Reading the list…'
          )}
        </p>
      </div>

      {notice && (
        <p
          className={
            notice.kind === 'ok' ? styles.noticeOk : styles.noticeError
          }
        >
          {notice.text}
        </p>
      )}
      {loadError && (
        <p className={styles.noticeError}>
          Could not read the user list: {loadError}
        </p>
      )}

      {data && data.requests.length > 0 && (
        <div className={adminStyles.editorBlock}>
          <div className={adminStyles.editorBlockHeader}>
            <h2 className={adminStyles.editorBlockTitle}>
              Waiting for approval · {data.requests.length}
            </h2>
          </div>
          <p className={adminStyles.sectionHint}>
            These people signed in with Google but aren&apos;t on the list. Tick
            the tabs they should get and approve, or dismiss. Nothing is granted
            until you approve.
          </p>
          <div className={styles.people}>
            {data.requests.map(r => {
              const picks = requestPicks[r.email] ?? DEFAULT_NEW_ACCESS
              return (
                <div key={r.email} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardWho}>
                      {r.name && (
                        <span className={styles.cardName}>{r.name}</span>
                      )}
                      <span className={styles.cardEmail}>{r.email}</span>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={adminStyles.editorButtonPrimary}
                        disabled={busy}
                        onClick={() =>
                          void call(
                            'POST',
                            { email: r.email, access: picks },
                            `${r.name ?? r.email} can now sign in.`
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className={styles.linkButton}
                        disabled={busy}
                        onClick={() =>
                          void call(
                            'DELETE',
                            { email: r.email },
                            `Request from ${r.name ?? r.email} dismissed.`,
                            '/api/admin/users/requests'
                          )
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <AccessPicker
                    idPrefix={`r-${r.email}`}
                    value={picks}
                    disabled={busy}
                    onChange={next =>
                      setRequestPicks({ ...requestPicks, [r.email]: next })
                    }
                  />
                  <div className={styles.cardMeta}>
                    <span>
                      Tried {r.count === 1 ? 'once' : `${r.count} times`}, last{' '}
                      {when(r.lastAt)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className={adminStyles.editorBlock}>
        <div className={adminStyles.editorBlockHeader}>
          <h2 className={adminStyles.editorBlockTitle}>Who can sign in</h2>
        </div>
        <p className={adminStyles.sectionHint}>
          Each person signs in with the Google account shown and sees only the
          tabs ticked here. Ticking or unticking a tab applies on their next
          click; removing someone signs them out immediately. Built-in rows live
          in the code and can&apos;t be changed from this page.
        </p>
        {data && (
          <div className={styles.people}>
            {data.users.map(u => (
              <div key={u.email} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardWho}>
                    {u.name ? (
                      <span className={styles.cardName}>{u.name}</span>
                    ) : (
                      <span className={styles.cardPending}>
                        Name appears after their first sign-in
                      </span>
                    )}
                    <span className={styles.cardEmail}>{u.email}</span>
                    {u.builtIn && (
                      <span className={styles.badge}>built in</span>
                    )}
                    {u.isMe && (
                      <span className={`${styles.badge} ${styles.badgeYou}`}>
                        you
                      </span>
                    )}
                  </div>
                  {!u.builtIn && !u.isMe && (
                    <div className={styles.rowActions}>
                      {removing === u.email ? (
                        <>
                          <span className={styles.confirmInline}>
                            Remove {who(u)}?
                          </span>
                          <button
                            type="button"
                            className={`${styles.linkButton} ${styles.danger}`}
                            disabled={busy}
                            onClick={() => {
                              setRemoving(null)
                              void call(
                                'DELETE',
                                { email: u.email },
                                `${who(u)} can no longer sign in.`
                              )
                            }}
                          >
                            Yes, remove
                          </button>
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => setRemoving(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={styles.linkButton}
                          disabled={busy}
                          onClick={() => setRemoving(u.email)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <AccessPicker
                  idPrefix={`u-${u.email}`}
                  value={u.access}
                  disabled={busy || u.builtIn}
                  onChange={next => setAccess(u, next)}
                />
                <div className={styles.cardMeta}>
                  <span>
                    {u.addedAt
                      ? `Added ${when(u.addedAt)}${u.addedBy ? ` by ${u.addedBy}` : ''}`
                      : 'Built into the code'}
                  </span>
                  <span>Last sign-in {when(u.lastSignInAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {!data && loading && <p className={styles.notice}>Loading…</p>}
      </div>

      <div className={adminStyles.editorBlock}>
        <div className={adminStyles.editorBlockHeader}>
          <h2 className={adminStyles.editorBlockTitle}>Add someone</h2>
        </div>
        <p className={adminStyles.sectionHint}>
          Enter the address of the Google account they will sign in with and
          tick the tabs they should see. They go to /admin/login, click Sign in
          with Google, and allow the app once; their name is picked up from
          Google then.
        </p>
        <form className={styles.form} onSubmit={add}>
          <label className={`${styles.field} ${styles.emailField}`}>
            <span className={styles.fieldLabel}>Google account email</span>
            <input
              type="email"
              required
              className={adminStyles.editorInput}
              value={form.email}
              disabled={busy}
              placeholder="name@example.com"
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Tabs they can open</span>
            <AccessPicker
              idPrefix="new"
              value={form.access}
              disabled={busy}
              onChange={access => setForm({ ...form, access })}
            />
          </div>
          <div className={styles.formActions}>
            <button
              type="submit"
              className={`${adminStyles.editorButtonPrimary} ${styles.addButton}`}
              disabled={busy || !data}
            >
              {busy ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>

      {data && data.activity.length > 0 && (
        <div className={adminStyles.editorBlock}>
          <div className={adminStyles.editorBlockHeader}>
            <h2 className={adminStyles.editorBlockTitle}>Recent activity</h2>
          </div>
          <p className={adminStyles.sectionHint}>
            Sign-ins, access requests, approvals, tab changes, removals and
            newsletter sends, newest first.
          </p>
          <ul className={styles.activity}>
            {data.activity.map((e, i) => (
              <li key={`${e.at}-${i}`} className={styles.activityRow}>
                <span className={styles.activityWhen}>{when(e.at)}</span>
                <span>{describeEvent(e)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && !data.shared && (
        <p className={styles.notice}>
          Local copy: this checkout has no shared database, so the list above is
          stored in .admin-dev/users.json and only applies here.
        </p>
      )}
    </div>
  )
}
