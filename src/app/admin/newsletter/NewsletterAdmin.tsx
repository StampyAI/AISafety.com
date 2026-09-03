'use client'

import { useCallback, useEffect, useState } from 'react'
import adminStyles from '../admin.module.css'
import styles from './newsletter.module.css'

interface Draft {
  id: string
  name: string
  subject: string
  fromEmail: string
  fromName: string
  createdAt: string | null
  listId: string | null
  listName: string | null
  activeContacts: number | null
  problems: string[]
}

interface Recent {
  id: string
  name: string
  status: 'scheduled' | 'sending' | 'sent' | 'stopped' | 'paused'
  scheduledFor: string | null
  sentAt: string | null
  sentTo: number
  uniqueOpens: number | null
  unsubscribes: number | null
  listNames: string[]
}

interface Payload {
  fetchedAt: string
  drafts: Draft[]
  recent: Recent[]
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

export default function NewsletterAdmin() {
  const [data, setData] = useState<Payload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/newsletter', { cache: 'no-store' })
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

  async function approve(draft: Draft) {
    if (!draft.listId) return
    const who =
      draft.activeContacts == null
        ? `everyone on “${draft.listName ?? draft.listId}”`
        : `${draft.activeContacts} contact${draft.activeContacts === 1 ? '' : 's'} on “${draft.listName ?? draft.listId}”`
    if (
      !window.confirm(
        `Send “${draft.subject}” to ${who}?\n\nIt goes out about two minutes after you confirm and cannot be recalled.`
      )
    ) {
      return
    }
    setBusyId(draft.id)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: draft.id, list: draft.listId }),
      })
      const body = (await res.json()) as {
        error?: string
        problems?: string[]
        campaignId?: string
        sdate?: string
      }
      if (!res.ok) {
        const detail = body.problems?.length
          ? body.problems.join('; ')
          : (body.error ?? `HTTP ${res.status}`)
        throw new Error(detail)
      }
      setNotice({
        kind: 'ok',
        text: `Approved. “${draft.subject}” is scheduled to send at ${when(body.sdate ?? null)} (campaign ${body.campaignId}). Nothing more to do.`,
      })
      if (previewId === draft.id) setPreviewId(null)
      await load()
    } catch (err) {
      setNotice({
        kind: 'error',
        text: `Not sent: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={adminStyles.editorColumn}>
      <div className={adminStyles.pageHeading}>
        <h1 className={adminStyles.pageTitle}>Newsletters</h1>
        <p className={adminStyles.pageMeta}>
          {data ? (
            <>
              ActiveCampaign read{' '}
              <span className={adminStyles.pageMetaValue}>
                {when(data.fetchedAt)}
              </span>
            </>
          ) : (
            'Reading ActiveCampaign…'
          )}{' '}
          <button
            type="button"
            className={styles.button}
            onClick={() => void load()}
            disabled={loading}
            style={{ marginLeft: 12, padding: '4px 10px', fontSize: 12 }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
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
          Could not read ActiveCampaign: {loadError}
        </p>
      )}

      <div className={adminStyles.editorBlock}>
        <div className={adminStyles.editorBlockHeader}>
          <h2 className={adminStyles.editorBlockTitle}>
            Waiting for approval{data ? ` · ${data.drafts.length}` : ''}
          </h2>
        </div>
        <p className={adminStyles.sectionHint}>
          Issues the pipeline has drafted from Pen. Each one is re-checked here
          before sending: still a draft, wired to exactly one list, content
          untouched since the pipeline wrote it. Approving schedules the send
          for about two minutes later.
        </p>
        {data && data.drafts.length === 0 && !loading && (
          <p className={styles.notice}>
            Nothing waiting. A draft appears here when the pipeline finishes an
            issue.
          </p>
        )}
        {data?.drafts.map(draft => {
          const ok = draft.problems.length === 0 && draft.listId != null
          return (
            <div key={draft.id} className={adminStyles.editorBlock}>
              <div className={adminStyles.editorBlockHeader}>
                <h3 className={adminStyles.editorBlockTitle}>
                  {draft.subject}
                </h3>
                <span className={ok ? styles.statusOk : styles.statusBad}>
                  {ok ? 'Verified' : 'Cannot send'}
                </span>
              </div>
              <p className={styles.draftMeta}>
                <span>
                  To{' '}
                  <span className={styles.draftMetaValue}>
                    {draft.listName ??
                      (draft.listId ? `list ${draft.listId}` : 'no list')}
                  </span>
                  {draft.activeContacts != null && (
                    <>
                      {' '}
                      ·{' '}
                      <span className={styles.draftMetaValue}>
                        {draft.activeContacts}
                      </span>{' '}
                      active contact{draft.activeContacts === 1 ? '' : 's'}
                    </>
                  )}
                </span>
                <span>
                  From{' '}
                  <span className={styles.draftMetaValue}>
                    {draft.fromName} &lt;{draft.fromEmail}&gt;
                  </span>
                </span>
                <span>
                  Drafted{' '}
                  <span className={styles.draftMetaValue}>
                    {when(draft.createdAt)}
                  </span>
                </span>
                <span className={styles.muted}>campaign {draft.id}</span>
              </p>
              {draft.problems.length > 0 && (
                <ul className={styles.problems}>
                  {draft.problems.map(p => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() =>
                    setPreviewId(previewId === draft.id ? null : draft.id)
                  }
                >
                  {previewId === draft.id ? 'Hide preview' : 'Preview'}
                </button>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={() => void approve(draft)}
                  disabled={!ok || busyId != null}
                >
                  {busyId === draft.id ? 'Scheduling…' : 'Approve & send'}
                </button>
              </div>
              {previewId === draft.id && (
                <iframe
                  title={`Preview of ${draft.subject}`}
                  className={styles.previewFrame}
                  sandbox=""
                  src={`/api/admin/newsletter/preview?draft=${draft.id}`}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className={adminStyles.editorBlock}>
        <div className={adminStyles.editorBlockHeader}>
          <h2 className={adminStyles.editorBlockTitle}>Recent sends</h2>
        </div>
        {data && data.recent.length === 0 && (
          <p className={styles.notice}>No sends yet.</p>
        )}
        {data && data.recent.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>List</th>
                <th>Status</th>
                <th>Sent</th>
                <th>To</th>
                <th>Opens</th>
                <th>Unsubs</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className={styles.muted}>
                    {r.listNames.join(', ') || '—'}
                  </td>
                  <td>
                    {r.status === 'sent' ? (
                      <span className={styles.statusOk}>sent</span>
                    ) : r.status === 'stopped' ? (
                      <span className={styles.statusBad}>stopped</span>
                    ) : (
                      r.status
                    )}
                  </td>
                  <td className={styles.muted}>
                    {r.status === 'scheduled'
                      ? `due ${when(r.scheduledFor)}`
                      : when(r.sentAt)}
                  </td>
                  <td>{r.sentTo}</td>
                  <td className={styles.muted}>{r.uniqueOpens ?? '—'}</td>
                  <td className={styles.muted}>{r.unsubscribes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
