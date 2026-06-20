import {
  readDashboard,
  type Counted,
  type DateRange,
  type ChatbotFunnel,
} from '@/lib/analytics/events'
import { getFunders } from '@/lib/data/funding'
import DateRangePicker from './DateRangePicker'
import Logo from './Logo'
import admin from '../admin.module.css'
import styles from './analytics.module.css'

// Always render fresh — the dashboard reflects live event counts and the
// selected date range comes from the query string.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const SOURCE_LABEL: Record<string, string> = {
  redis: 'Live',
  'local-file': 'Local dev',
  none: 'No data yet',
}

// Bryce is in Colombia — fixed UTC-5, no DST — so day boundaries use -05:00.
const TZ_OFFSET = '-05:00'
const DAY = 86_400_000

interface ResolvedRange extends DateRange {
  key: string // active preset key, or 'custom'
  from?: string
  to?: string
}

type SearchParams = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/** Translate the query string into concrete epoch-ms bounds. Defaults to the
 *  last 30 days. A custom from/to (inclusive, Bogotá day boundaries) wins. */
function resolveRange(sp: SearchParams): ResolvedRange {
  const from = first(sp.from)
  const to = first(sp.to)
  if (from || to) {
    const s = from ? Date.parse(`${from}T00:00:00${TZ_OFFSET}`) : NaN
    const e = to ? Date.parse(`${to}T23:59:59.999${TZ_OFFSET}`) : NaN
    return {
      startMs: Number.isNaN(s) ? null : s,
      endMs: Number.isNaN(e) ? null : e,
      key: 'custom',
      from,
      to,
    }
  }
  const range = first(sp.range) ?? '30d'
  const now = Date.now()
  switch (range) {
    case 'today': {
      const today = new Date(now - 5 * 3_600_000).toISOString().slice(0, 10)
      return {
        startMs: Date.parse(`${today}T00:00:00${TZ_OFFSET}`),
        endMs: null,
        key: 'today',
      }
    }
    case '7d':
      return { startMs: now - 7 * DAY, endMs: null, key: '7d' }
    case '90d':
      return { startMs: now - 90 * DAY, endMs: null, key: '90d' }
    case 'all':
      return { startMs: null, endMs: null, key: 'all' }
    case '30d':
    default:
      return { startMs: now - 30 * DAY, endMs: null, key: '30d' }
  }
}

/** A favicon for any outbound URL — the universal fallback when a listing has
 *  no Airtable logo (or the event isn't a funding listing). */
function faviconFor(url?: string): string | undefined {
  if (!url || url === '#') return undefined
  try {
    const host = new URL(url).hostname
    if (!host) return undefined
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
  } catch {
    return undefined
  }
}

/** en-GB so the date reads day-before-month (e.g. "19 Jun, 20:30"). */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    return u.hostname.replace(/^www\./, '') + path
  } catch {
    return url
  }
}

const CHATBOT_LABELS: Record<string, string> = {
  chatbot_open: 'Opened the chatbot',
  chatbot_message: 'Sent a message',
  chatbot_click: 'Clicked a result',
}

function pillFor(e: { page?: string; type: string }): string | null {
  if (e.page) return e.page
  if (e.type.startsWith('chatbot')) return 'Chatbot'
  return null
}

function labelFor(e: { label?: string; type: string }): string {
  return e.label ?? CHATBOT_LABELS[e.type] ?? e.type
}

/** Conversion percentage of one funnel stage relative to the previous. */
function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((100 * part) / whole)}%` : '—'
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const range = resolveRange(await searchParams)
  const [data, funders] = await Promise.all([
    readDashboard(range),
    getFunders().catch(() => []),
  ])

  // Map funding listings back to their logos by id (for clicks) and by name
  // (for the top-listings table, which is keyed by display name).
  const logoById = new Map(funders.map(f => [f.id, f.logo]))
  const logoByName = new Map(funders.map(f => [f.name, f.logo]))

  return (
    <div>
      <div className={styles.headerRow}>
        <h1 className={admin.pageTitle}>Overview</h1>
        <div className={styles.meta}>
          <span className={styles.badge}>
            {SOURCE_LABEL[data.source] ?? data.source}
          </span>
          <span className={styles.total}>
            {data.totalEvents.toLocaleString()} events
          </span>
        </div>
      </div>

      <DateRangePicker activeKey={range.key} from={range.from} to={range.to} />

      {data.error ? (
        <div className={styles.empty}>
          Couldn&apos;t reach the analytics store just now — try refreshing in a
          moment.
        </div>
      ) : data.totalEvents === 0 ? (
        <div className={styles.empty}>
          No events in this range. Try a wider range, or click a listing on a
          resource page (e.g. /funding) to record one.
        </div>
      ) : (
        <>
          <Panel title="Chatbot funnel · unique users">
            <Funnel funnel={data.funnel} />
          </Panel>

          <div className={styles.grid}>
            <Panel title="Clicks by page">
              <CountTable rows={data.byPage} labelHead="Page" />
            </Panel>
            <Panel title="Top funding listings">
              <CountTable
                rows={data.topFunding}
                labelHead="Listing"
                logoFor={name => logoByName.get(name) ?? undefined}
              />
            </Panel>
          </div>

          <Panel title="Recent activity">
            {data.recent.length === 0 ? (
              <p className={styles.dim}>No recent events.</p>
            ) : (
              <ul className={styles.recent}>
                {data.recent.map((e, i) => (
                  <li key={i} className={styles.recentItem}>
                    <span className={styles.recentTime}>
                      {formatTime(e.ts)}
                    </span>
                    {pillFor(e) && (
                      <span className={styles.pill}>{pillFor(e)}</span>
                    )}
                    <Logo
                      src={
                        (e.listingId ? logoById.get(e.listingId) : undefined) ??
                        faviconFor(e.url)
                      }
                    />
                    <span className={styles.recentLabel}>{labelFor(e)}</span>
                    {e.url && e.url !== '#' && (
                      <a
                        className={styles.recentUrl}
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {prettyUrl(e.url)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {children}
    </section>
  )
}

function CountTable({
  rows,
  labelHead,
  logoFor,
}: {
  rows: Counted[]
  labelHead: string
  logoFor?: (name: string) => string | undefined
}) {
  if (rows.length === 0) return <p className={styles.dim}>No data yet.</p>
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{labelHead}</th>
          <th className={styles.numCol}>Clicks</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={styles.nameCell}>
              {logoFor && <Logo src={logoFor(r.name)} />}
              <span>{r.name}</span>
            </td>
            <td className={styles.numCol}>{r.count.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Funnel({ funnel }: { funnel: ChatbotFunnel }) {
  return (
    <div className={styles.funnel}>
      <FunnelStage label="Opened" value={funnel.opened} />
      <FunnelArrow pct={pct(funnel.typed, funnel.opened)} />
      <FunnelStage label="Sent a message" value={funnel.typed} />
      <FunnelArrow pct={pct(funnel.clicked, funnel.typed)} />
      <FunnelStage label="Clicked a result" value={funnel.clicked} />
    </div>
  )
}

function FunnelStage({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.funnelStage}>
      <div className={styles.funnelValue}>{value.toLocaleString()}</div>
      <div className={styles.funnelLabel}>{label}</div>
    </div>
  )
}

function FunnelArrow({ pct }: { pct: string }) {
  return (
    <div className={styles.funnelArrow}>
      <span className={styles.funnelArrowGlyph}>→</span>
      <span className={styles.funnelPct}>{pct}</span>
    </div>
  )
}
