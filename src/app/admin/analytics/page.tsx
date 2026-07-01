import Image from 'next/image'
import Link from 'next/link'
import {
  readDashboard,
  type Counted,
  type DateRange,
  type ChatbotFunnel,
  type OverallListingRow,
} from '@/lib/analytics/events'
import { getFunders } from '@/lib/data/funding'
import { getCourses } from '@/lib/data/self-study'
import { getAdvisors } from '@/lib/data/advisors'
import { getCommunities } from '@/lib/data/communities'
import { getMediaChannels } from '@/lib/data/media-channels'
import { getFounderResources } from '@/lib/data/founders'
import { getJobs } from '@/lib/data/jobs'
import { getMapData } from '@/lib/data/map'
import { getProjects } from '@/lib/data/projects'
import DateRangePicker from './DateRangePicker'
import ExcludeToggle from './ExcludeToggle'
import ExpandableBody from './ExpandableBody'
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

// Resource pages in the same order as the site nav. `name` is the analytics
// `page` value (the string passed to trackListingClick) and the tab key; `label`
// is the page's name on the live site (from Navigation.tsx) so the tabs read the
// way visitors see them — e.g. the 'Founders' page is labelled "Founder toolkit".
// Drives the order, labels, and icons of the page tabs; every page listed here
// always gets a tab (even with no clicks yet). Pages not listed (e.g. Home) sort
// after these, keeping their by-clicks order and showing their raw name.
const PAGE_NAV: { name: string; label: string; icon: string }[] = [
  { name: 'Map', label: 'Field map', icon: 'map.svg' },
  { name: 'Communities', label: 'Communities', icon: 'globe.svg' },
  { name: 'Self-study', label: 'Self-study', icon: 'book.svg' },
  { name: 'Jobs', label: 'Jobs', icon: 'briefcase.svg' },
  { name: 'Funding', label: 'Funding', icon: 'coins.svg' },
  { name: 'Media channels', label: 'Media channels', icon: 'megaphone.svg' },
  { name: 'Advisors', label: 'Advisors', icon: 'person.svg' },
  // Volunteer projects has no trackable clicks (its cards are plain text with no
  // links), so it gets no tab. If it's ever tracked, add it back here.
  { name: 'Founders', label: 'Founder toolkit', icon: 'rocket.svg' },
]

// The two non-page tabs that lead the tab bar. Their keys are reserved, so a
// resource page can never collide with them.
const OVERVIEW_TABS: { key: string; label: string }[] = [
  { key: 'pages', label: 'Overview' },
  { key: 'funnel', label: 'Chatbot funnel' },
]
const OVERVIEW_KEYS = new Set(OVERVIEW_TABS.map(t => t.key))

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

/** Real Airtable logos for the selected page's listings, keyed by the exact
 *  label each click was tracked under, so the top-listings table shows proper
 *  logos instead of favicons. Returns an empty map (→ favicons) on any error or
 *  for pages without listing data. */
async function logosForPage(
  page: string | null
): Promise<Map<string, string | null>> {
  try {
    switch (page) {
      case 'Funding':
        return new Map((await getFunders()).map(i => [i.name, i.logo]))
      case 'Self-study':
        return new Map((await getCourses()).map(i => [i.name, i.image]))
      case 'Advisors':
        return new Map((await getAdvisors()).map(i => [i.name, i.logo]))
      case 'Communities':
        return new Map((await getCommunities()).map(i => [i.name, i.logo]))
      case 'Media channels':
        return new Map((await getMediaChannels()).map(i => [i.name, i.logo]))
      case 'Founders':
        return new Map(
          (await getFounderResources()).map(i => [i.name, i.image])
        )
      case 'Projects':
        return new Map((await getProjects()).map(i => [i.name, i.logo]))
      case 'Jobs':
        return new Map(
          (await getJobs()).map(i => [`${i.name} – ${i.organization}`, i.logo])
        )
      case 'Map':
        return new Map((await getMapData()).records.map(i => [i.title, i.logo]))
      default:
        return new Map()
    }
  } catch {
    return new Map()
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

/** A share of `total` to one decimal place, e.g. "43.2%". */
function pct1(part: number, total: number): string {
  return `${((100 * part) / total).toFixed(1)}%`
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

  // The dashboard is tabbed: two overview tabs (the funnel and the by-page
  // table) plus one tab per resource page. `tab` holds the active tab — an
  // overview key, or a resource page's analytics name. A resource tab is the
  // page we ask the store to drill into; the overview tabs need no page.
  const tabReq = first(sp.tab)
  const onResourceTab = tabReq != null && !OVERVIEW_KEYS.has(tabReq)

  const [data, funders] = await Promise.all([
    readDashboard(
      range,
      onResourceTab ? tabReq : undefined,
      unique,
      first(sp.source)
    ),
    getFunders().catch(() => []),
  ])

  // Resource-page tabs: every page in PAGE_NAV always gets one (so quiet pages
  // like Projects still appear), plus any other page that has clicks (e.g.
  // Home). Ordered Home first, then site-nav order, then the rest.
  const pageOrder = new Map(PAGE_NAV.map((p, i) => [p.name, i]))
  const labelByPage = new Map(PAGE_NAV.map(p => [p.name, p.label]))
  const iconByPage = new Map(PAGE_NAV.map(p => [p.name, p.icon]))
  const orderOf = (name: string) =>
    name === 'Home' ? -1 : (pageOrder.get(name) ?? 999)
  const resourceNames = [
    ...new Set([...PAGE_NAV.map(p => p.name), ...data.byPage.map(p => p.name)]),
  ].sort((a, b) => orderOf(a) - orderOf(b))
  const resourceTabs = resourceNames.map(name => ({
    key: name,
    label: labelByPage.get(name) ?? name,
    icon: iconByPage.get(name),
  }))

  // Resolve the active tab: the requested one if it's a real tab, else the
  // default overview ('pages'). onResourceView gates the per-page panels.
  const tabKeys = new Set<string>([...OVERVIEW_KEYS, ...resourceNames])
  const activeTab = tabReq && tabKeys.has(tabReq) ? tabReq : 'pages'
  const onResourceView = !OVERVIEW_KEYS.has(activeTab)
  const selectedLabel = data.selectedPage
    ? (labelByPage.get(data.selectedPage) ?? data.selectedPage)
    : null

  // logoById drives the recent-activity feed (funding listings, by record id).
  // logoByName drives the top-listings table for the selected page, fetched from
  // that page's Airtable data so every page shows real logos — not just funding.
  // Funding reuses the already-fetched funders. Only needed on a resource view.
  const logoById = new Map(funders.map(f => [f.id, f.logo]))
  const logoByName = !onResourceView
    ? new Map<string, string | null>()
    : data.selectedPage === 'Funding'
      ? new Map<string, string | null>(funders.map(f => [f.name, f.logo]))
      : await logosForPage(data.selectedPage)

  // Per-listing slot range + a url for the favicon, keyed by display name, for
  // whichever page is selected. The slot is stamped onto the click when it
  // happens, so it stays accurate even as the page is reordered; it's undefined
  // for listings whose clicks predate slot tracking.
  const positionByName = new Map(
    data.topListings.map(r => [r.name, r.position])
  )
  const urlByName = new Map(data.topListings.map(r => [r.name, r.url]))

  // Chart totals (also the % denominators). The listings total is the selected
  // page's whole click count, not just the rows currently revealed.
  const totalClicks = data.byPage.reduce((sum, r) => sum + r.count, 0)
  const pageTotal = data.byPage.find(p => p.name === data.selectedPage)?.count
  // When the listings are filtered to one source, the top-listings table is a
  // share of that source's clicks, not the page's whole. bySource carries the
  // per-source totals, so read the active one from there.
  const listingTotal = data.selectedSource
    ? data.bySource.find(r => r.name.toLowerCase() === data.selectedSource)
        ?.count
    : pageTotal
  const positionTotal = data.byPosition.reduce((sum, r) => sum + r.count, 0)

  // Site-wide leaderboards for the Overview tab. The listings total is every
  // page's clicks (same denominator as "Clicks by page"); the position total is
  // only the clicks that carry a slot. Resolve each row's page to its site label
  // (e.g. 'Founders' → 'Founder toolkit') so the page pills read the site's way.
  const overallListings = data.topListingsOverall.map(r => ({
    ...r,
    pageLabel: r.page ? (labelByPage.get(r.page) ?? r.page) : undefined,
  }))
  const overallPositionTotal = data.byPositionOverall.reduce(
    (sum, r) => sum + r.count,
    0
  )

  return (
    <div>
      <div className={styles.headerRow}>
        <h1 className={admin.pageTitle}>Analytics</h1>
        <div className={styles.meta}>
          <span className={styles.badge}>
            {SOURCE_LABEL[data.source] ?? data.source}
          </span>
          <span className={styles.total}>
            {data.totalEvents.toLocaleString()} events
          </span>
          <ExcludeToggle />
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
          <DashboardTabs
            overview={OVERVIEW_TABS}
            pages={resourceTabs}
            active={activeTab}
            params={sp}
          />

          {activeTab === 'funnel' && (
            <Panel title="Chatbot funnel · unique users">
              <Funnel funnel={data.funnel} />
            </Panel>
          )}

          {activeTab === 'pages' && (
            <Panel title="Clicks by page">
              <CountTable
                rows={data.byPage}
                labelHead="Page"
                total={totalClicks}
              />
            </Panel>
          )}

          {onResourceView && (
            <div className={styles.pageSection}>
              <SourceSplit
                rows={data.bySource}
                active={data.selectedSource}
                params={sp}
              />
              <div className={styles.grid}>
                <Panel
                  title={
                    selectedLabel
                      ? `Top ${selectedLabel} listings`
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
                    linkFor={name => urlByName.get(name)}
                    rankFor={name => positionByName.get(name)}
                    total={listingTotal}
                  />
                  <p className={styles.caption}>
                    Slot = where each listing was clicked this period (F1/F2 =
                    featured cards). Blank for clicks logged before slot
                    tracking.
                  </p>
                </Panel>
                <Panel title="Clicks by position">
                  <CountTable
                    rows={data.byPosition}
                    labelHead="Slot"
                    total={positionTotal}
                  />
                  <p className={styles.caption}>
                    Every click on this page counted at the slot it happened in
                    — so a busy top slot shows up even as different listings
                    rotate through it.
                  </p>
                </Panel>
              </div>
            </div>
          )}

          {activeTab === 'pages' && (
            <div className={styles.grid}>
              <Panel title="Most clicked listings overall">
                <OverallListingsTable
                  rows={overallListings}
                  total={totalClicks}
                />
                <p className={styles.caption}>
                  Every listing across all resource pages, ranked by clicks this
                  period. Open a page&apos;s tab for its own breakdown.
                </p>
              </Panel>
              <Panel title="Clicks by position overall">
                <CountTable
                  rows={data.byPositionOverall}
                  labelHead="Slot"
                  total={overallPositionTotal}
                />
                <p className={styles.caption}>
                  Every click across all pages counted at the slot it happened
                  in (F1/F2 = featured cards) — how much attention each slot
                  draws site-wide.
                </p>
              </Panel>
            </div>
          )}

          {activeTab === 'pages' && (
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
                          (e.listingId
                            ? logoById.get(e.listingId)
                            : undefined) ?? faviconFor(e.url)
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
          )}
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
      <Link
        href={uniqueQ ? `?${uniqueQ}` : '?'}
        scroll={false}
        className={`${styles.clickToggleBtn}${
          unique ? ` ${styles.clickToggleBtnActive}` : ''
        }`}
      >
        Unique
      </Link>
      <Link
        href={`?${totalParams.toString()}`}
        scroll={false}
        className={`${styles.clickToggleBtn}${
          !unique ? ` ${styles.clickToggleBtnActive}` : ''
        }`}
      >
        Total
      </Link>
    </div>
  )
}

/** For pages with a map, shows how the selected page's clicks split between the
 *  map and the cards. Each split is a link that filters the listing panels below
 *  to that source; "Total" clears the filter. Renders nothing for pages without
 *  a map. */
function SourceSplit({
  rows,
  active,
  params,
}: {
  rows: Counted[]
  active: string | null
  params: SearchParams
}) {
  if (rows.length === 0) return null
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const hasUntracked = rows.some(r => r.name === 'Untracked')
  // Preserve every other query param; only the `source` filter is swapped.
  const base = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (k === 'source' || v == null) continue
    base.set(k, Array.isArray(v) ? (v[0] ?? '') : v)
  }
  const totalHref = base.toString() ? `?${base.toString()}` : '?'
  return (
    <div className={styles.sourceSplitWrap}>
      <div className={styles.sourceSplit}>
        <span className={styles.sourceSplitLabel}>Clicks by source</span>
        {rows.length > 1 && (
          <Link
            href={totalHref}
            scroll={false}
            className={`${styles.sourceStat} ${styles.sourceStatLink}${
              active == null ? ` ${styles.sourceStatActive}` : ''
            }`}
          >
            <span className={styles.sourceStatName}>Total</span>
            <span className={styles.sourceStatCount}>
              {total.toLocaleString()}
            </span>
          </Link>
        )}
        {rows.map(r => {
          const key = r.name.toLowerCase()
          const q = new URLSearchParams(base)
          q.set('source', key)
          return (
            <Link
              key={r.name}
              href={`?${q.toString()}`}
              scroll={false}
              className={`${styles.sourceStat} ${styles.sourceStatLink}${
                active === key ? ` ${styles.sourceStatActive}` : ''
              }`}
            >
              <span className={styles.sourceStatName}>{r.name}</span>
              <span className={styles.sourceStatCount}>
                {r.count.toLocaleString()}
              </span>
              {total > 0 && (
                <span className={styles.sourceStatPct}>
                  {pct1(r.count, total)}
                </span>
              )}
            </Link>
          )
        })}
      </div>
      {hasUntracked && (
        <p className={styles.caption}>
          Untracked = clicks logged before map/card source tracking started;
          they age out as the date range moves forward.
        </p>
      )}
    </div>
  )
}

/** Tabs that pick which resource page the listing panels drill into. Each tab
 *  preserves the current date range and swaps only the `page` query param. */
/** The dashboard's top tab bar: two overview tabs (the funnel and the by-page
 *  table), a divider, then one tab per resource page. Each tab swaps the `tab`
 *  query param (and drops any active source filter) while preserving the date
 *  range and count mode. Resource tabs show the site's page name and nav icon. */
function DashboardTabs({
  overview,
  pages,
  active,
  params,
}: {
  overview: { key: string; label: string }[]
  pages: { key: string; label: string; icon?: string }[]
  active: string
  params: SearchParams
}) {
  // Preserve everything except the tab itself and the per-page source filter
  // (which is meaningless once you switch tabs); `page` is the old param name.
  const base = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (k === 'tab' || k === 'source' || k === 'page' || v == null) continue
    base.set(k, Array.isArray(v) ? (v[0] ?? '') : v)
  }
  const hrefFor = (key: string) => {
    const q = new URLSearchParams(base)
    q.set('tab', key)
    return `?${q.toString()}`
  }
  const tabClass = (key: string) =>
    `${styles.pageTab}${key === active ? ` ${styles.pageTabActive}` : ''}`
  return (
    <div className={styles.pageTabs}>
      {overview.map(t => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          scroll={false}
          className={tabClass(t.key)}
        >
          {t.label}
        </Link>
      ))}
      <span className={styles.tabDivider} aria-hidden />
      {pages.map(t => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          scroll={false}
          className={tabClass(t.key)}
        >
          {t.icon && (
            <span className={styles.pageTabIcon}>
              <Image src={`/images/${t.icon}`} alt="" width={12} height={12} />
            </span>
          )}
          {t.label}
        </Link>
      ))}
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
  linkFor,
  rankFor,
  total,
}: {
  rows: Counted[]
  labelHead: string
  rankHead?: string
  logoFor?: (name: string) => string | undefined
  /** Destination url for a row's logo. When set, the logo becomes a link to the
   *  listing; the name text is deliberately left unlinked so it stays
   *  selectable/copyable. */
  linkFor?: (name: string) => string | undefined
  rankFor?: (name: string) => string | undefined
  /** When set, adds a % column (each row's share of this total) and a Total
   *  footer row. The total is the denominator, so for a sliced "top N" table it
   *  can exceed the sum of the visible rows. */
  total?: number
}) {
  if (rows.length === 0) return <p className={styles.dim}>No data yet.</p>
  const showPct = total != null && total > 0
  const colSpan = (rankFor ? 1 : 0) + 2 + (showPct ? 1 : 0)
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {rankFor && <th className={styles.rankCol}>{rankHead}</th>}
          <th>{labelHead}</th>
          <th className={styles.numCol}>Clicks</th>
          {showPct && <th className={styles.pctCol}>%</th>}
        </tr>
      </thead>
      <ExpandableBody colSpan={colSpan}>
        {rows.map((r, i) => {
          const rank = rankFor?.(r.name)
          const featured = rank?.startsWith('F')
          const href = linkFor?.(r.name)
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
                {logoFor &&
                  (href && href !== '#' ? (
                    <a
                      className={styles.logoLink}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${r.name}`}
                    >
                      <Logo src={logoFor(r.name)} />
                    </a>
                  ) : (
                    <Logo src={logoFor(r.name)} />
                  ))}
                <span>{r.name}</span>
              </td>
              <td className={styles.numCol}>{r.count.toLocaleString()}</td>
              {showPct && (
                <td className={styles.pctCol}>{pct1(r.count, total)}</td>
              )}
            </tr>
          )
        })}
      </ExpandableBody>
      {total != null && (
        <tfoot>
          <tr className={styles.totalRow}>
            {rankFor && <td className={styles.rankCol} />}
            <td className={styles.totalLabel}>Total</td>
            <td className={styles.numCol}>{total.toLocaleString()}</td>
            {showPct && <td className={styles.pctCol}>{pct1(total, total)}</td>}
          </tr>
        </tfoot>
      )}
    </table>
  )
}

/** The Overview tab's site-wide listings leaderboard. Like CountTable, but each
 *  row carries the page it came from (shown as a pill) and always uses a favicon
 *  — listings here span every page, so there's no single page's logos to load.
 *  `total` is every page's click count, so the top-N rows can sum to less than
 *  it; the Total footer shows the true denominator. */
function OverallListingsTable({
  rows,
  total,
}: {
  rows: (OverallListingRow & { pageLabel?: string })[]
  total: number
}) {
  if (rows.length === 0) return <p className={styles.dim}>No data yet.</p>
  const showPct = total > 0
  const colSpan = 3 + (showPct ? 1 : 0)
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Listing</th>
          <th>Page</th>
          <th className={styles.numCol}>Clicks</th>
          {showPct && <th className={styles.pctCol}>%</th>}
        </tr>
      </thead>
      <ExpandableBody colSpan={colSpan}>
        {rows.map((r, i) => {
          const favicon = faviconFor(r.url)
          const href = r.url
          return (
            <tr key={i}>
              <td className={styles.nameCell}>
                {href && href !== '#' ? (
                  <a
                    className={styles.logoLink}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${r.name}`}
                  >
                    <Logo src={favicon} />
                  </a>
                ) : (
                  <Logo src={favicon} />
                )}
                <span>{r.name}</span>
              </td>
              <td>
                {r.pageLabel && (
                  <span className={styles.pill}>{r.pageLabel}</span>
                )}
              </td>
              <td className={styles.numCol}>{r.count.toLocaleString()}</td>
              {showPct && (
                <td className={styles.pctCol}>{pct1(r.count, total)}</td>
              )}
            </tr>
          )
        })}
      </ExpandableBody>
      <tfoot>
        <tr className={styles.totalRow}>
          <td className={styles.totalLabel}>Total</td>
          <td />
          <td className={styles.numCol}>{total.toLocaleString()}</td>
          {showPct && <td className={styles.pctCol}>{pct1(total, total)}</td>}
        </tr>
      </tfoot>
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
