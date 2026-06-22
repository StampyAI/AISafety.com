import Image from 'next/image'
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

// Resource pages in the same order as the site nav, each with its nav icon.
// Keyed by the analytics `page` value (the string passed to trackListingClick).
// Drives the order and icons of the page tabs; pages not listed here (e.g.
// Home) sort after these, keeping their by-clicks order.
const PAGE_NAV: { name: string; icon: string }[] = [
  { name: 'Map', icon: 'map.svg' },
  { name: 'Communities', icon: 'globe.svg' },
  { name: 'Self-study', icon: 'book.svg' },
  { name: 'Jobs', icon: 'briefcase.svg' },
  { name: 'Funding', icon: 'coins.svg' },
  { name: 'Media channels', icon: 'megaphone.svg' },
  { name: 'Advisors', icon: 'person.svg' },
  { name: 'Projects', icon: 'clipboard.svg' },
  { name: 'Founders', icon: 'rocket.svg' },
]

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
  const sp = await searchParams
  const range = resolveRange(sp)
  // Count each visitor once per listing per day by default; ?clicks=total counts
  // every click.
  const unique = first(sp.clicks) !== 'total'
  const [data, funders] = await Promise.all([
    readDashboard(range, first(sp.page), unique),
    getFunders().catch(() => []),
  ])

  // Funding listings have Airtable logos (by id for the activity feed, by name
  // for the top-listings table). Other pages fall back to a favicon derived
  // from each listing's most-recent click url.
  const logoById = new Map(funders.map(f => [f.id, f.logo]))
  const logoByName = new Map(funders.map(f => [f.name, f.logo]))

  // Per-listing slot range + a url for the favicon, keyed by display name, for
  // whichever page is selected. The slot is stamped onto the click when it
  // happens, so it stays accurate even as the page is reordered; it's undefined
  // for listings whose clicks predate slot tracking.
  const positionByName = new Map(
    data.topListings.map(r => [r.name, r.position])
  )
  const urlByName = new Map(data.topListings.map(r => [r.name, r.url]))

  // Page tabs in site-nav order (pages not in the nav fall to the end), each
  // carrying its nav icon.
  const pageOrder = new Map(PAGE_NAV.map((p, i) => [p.name, i]))
  const iconByPage = new Map(PAGE_NAV.map(p => [p.name, p.icon]))
  const tabPages = data.byPage
    .map(p => p.name)
    .sort((a, b) => (pageOrder.get(a) ?? 999) - (pageOrder.get(b) ?? 999))
    .map(name => ({ name, icon: iconByPage.get(name) }))

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

      <ClickModeToggle unique={unique} params={sp} />

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

          <Panel title="Clicks by page">
            <CountTable rows={data.byPage} labelHead="Page" />
          </Panel>

          <div className={styles.pageSection}>
            <PageTabs pages={tabPages} active={data.selectedPage} params={sp} />
            <div className={styles.grid}>
              <Panel
                title={
                  data.selectedPage
                    ? `Top ${data.selectedPage} listings`
                    : 'Top listings'
                }
              >
                <CountTable
                  rows={data.topListings}
                  labelHead="Listing"
                  rankHead="Slot"
                  logoFor={name =>
                    logoByName.get(name) ?? faviconFor(urlByName.get(name))
                  }
                  rankFor={name => positionByName.get(name)}
                />
                <p className={styles.caption}>
                  Slot = where each listing was clicked this period (F1/F2 =
                  featured cards). Blank for clicks logged before slot tracking.
                </p>
              </Panel>
              <Panel title="Clicks by position">
                <CountTable rows={data.byPosition} labelHead="Slot" />
                <p className={styles.caption}>
                  Every click on this page counted at the slot it happened in —
                  so a busy top slot shows up even as different listings rotate
                  through it.
                </p>
              </Panel>
            </div>
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

/** Switches the click tables between unique counts (one per visitor per listing
 *  per day) and total counts. Unique is the default, so its link drops the param
 *  for a clean url; both links preserve the rest of the query. */
function ClickModeToggle({
  unique,
  params,
}: {
  unique: boolean
  params: SearchParams
}) {
  const base = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (k === 'clicks' || v == null) continue
    base.set(k, Array.isArray(v) ? (v[0] ?? '') : v)
  }
  const uniqueQ = base.toString()
  const totalParams = new URLSearchParams(base)
  totalParams.set('clicks', 'total')
  return (
    <div className={styles.clickToggle}>
      <span className={styles.clickToggleLabel}>Count</span>
      <a
        href={uniqueQ ? `?${uniqueQ}` : '?'}
        className={`${styles.clickToggleBtn}${
          unique ? ` ${styles.clickToggleBtnActive}` : ''
        }`}
      >
        Unique
      </a>
      <a
        href={`?${totalParams.toString()}`}
        className={`${styles.clickToggleBtn}${
          !unique ? ` ${styles.clickToggleBtnActive}` : ''
        }`}
      >
        Total
      </a>
    </div>
  )
}

/** Tabs that pick which resource page the listing panels drill into. Each tab
 *  preserves the current date range and swaps only the `page` query param. */
function PageTabs({
  pages,
  active,
  params,
}: {
  pages: { name: string; icon?: string }[]
  active: string | null
  params: SearchParams
}) {
  if (pages.length <= 1) return null
  const base = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page' || v == null) continue
    base.set(k, Array.isArray(v) ? (v[0] ?? '') : v)
  }
  return (
    <div className={styles.pageTabs}>
      {pages.map(({ name, icon }) => {
        const q = new URLSearchParams(base)
        q.set('page', name)
        return (
          <a
            key={name}
            href={`?${q.toString()}`}
            className={`${styles.pageTab}${
              name === active ? ` ${styles.pageTabActive}` : ''
            }`}
          >
            {icon && (
              <span className={styles.pageTabIcon}>
                <Image src={`/images/${icon}`} alt="" width={12} height={12} />
              </span>
            )}
            {name}
          </a>
        )
      })}
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
  rankHead = '#',
  logoFor,
  rankFor,
}: {
  rows: Counted[]
  labelHead: string
  rankHead?: string
  logoFor?: (name: string) => string | undefined
  rankFor?: (name: string) => string | undefined
}) {
  if (rows.length === 0) return <p className={styles.dim}>No data yet.</p>
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {rankFor && <th className={styles.rankCol}>{rankHead}</th>}
          <th>{labelHead}</th>
          <th className={styles.numCol}>Clicks</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const rank = rankFor?.(r.name)
          const featured = rank?.startsWith('F')
          return (
            <tr key={i}>
              {rankFor && (
                <td
                  className={`${styles.rankCol}${
                    featured ? ` ${styles.rankFeatured}` : ''
                  }`}
                >
                  {rank ?? '—'}
                </td>
              )}
              <td className={styles.nameCell}>
                {logoFor && <Logo src={logoFor(r.name)} />}
                <span>{r.name}</span>
              </td>
              <td className={styles.numCol}>{r.count.toLocaleString()}</td>
            </tr>
          )
        })}
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
