import { Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  readDashboard,
  type Counted,
  type DateRange,
  type ChatbotFunnel,
  type ClickDestination,
  type CorrelationRow,
  type OverallListingRow,
  type SearchPanelData,
} from '@/lib/analytics/events'
import {
  readConversationStats,
  type ConversationStats,
  type TopQuestion,
} from '@/lib/analytics/conversations'
import { readQuestionThemes, type ThemeSummary } from '@/lib/analytics/themes'
import {
  buildSearchIndex,
  type SearchEntry,
  type SearchType,
} from '@/lib/data/search-index'
import { TYPE_ICON, TYPE_LABEL, TYPE_PATH } from '@/lib/search'
import RefreshThemesButton from './RefreshThemesButton'
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
  { key: 'chatbot', label: 'Chatbot' },
  { key: 'search', label: 'Search' },
  { key: 'correlations', label: 'Correlations' },
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

/** A row's resource-page marker in the clicked-from-search table: the page's
 *  nav icon plus its name. */
interface PageBadge {
  icon: string | null
  label: string
}

/** '/jobs' → 'job', '/funding' → 'funder', … — so a click on a resource page
 *  itself (a 'page' search result) still resolves to that page's badge. */
const SEARCH_TYPE_BY_PATH = new Map<string, SearchType>(
  (Object.keys(TYPE_PATH) as SearchType[])
    .filter(t => TYPE_PATH[t])
    .map(t => [TYPE_PATH[t]!, t])
)

/** The page each clicked-from-search row belongs to. Newer clicks record the
 *  result's type at click time; rows without one (clicks from before the type
 *  was tracked) are matched against the live search index by url, then title.
 *  Resource-page rows get the page's icon and name; non-resource pages (Home,
 *  About, …) get their own title and nav icon, when they have one — Home
 *  renders as its title alone. A row that matches nothing — or
 *  whose url/title is shared by listings on two different pages — stays
 *  unresolved and shows no badge. */
function searchPageBadges(
  index: SearchEntry[],
  rows: { name: string; url?: string; resultType?: string }[]
): Map<string, PageBadge> {
  // null marks a url/title claimed by entries of two different types —
  // too ambiguous to resolve a page from.
  const byUrl = new Map<string, SearchType | null>()
  const byTitle = new Map<string, SearchType | null>()
  // Non-resource pages, keyed by url and title — the badge is the page's own
  // nav icon (when it has one, e.g. Home doesn't) and title.
  const pageByUrl = new Map<string, PageBadge>()
  const pageByTitle = new Map<string, PageBadge>()
  const claim = (
    m: Map<string, SearchType | null>,
    key: string,
    type: SearchType
  ) => {
    const prev = m.get(key)
    if (prev === undefined) m.set(key, type)
    else if (prev !== type) m.set(key, null)
  }
  for (const e of index) {
    // Page entries resolve to the resource page their url is; non-resource
    // pages (Home, About, …) resolve to their own title.
    const type = e.type === 'page' ? SEARCH_TYPE_BY_PATH.get(e.url) : e.type
    if (!type) {
      const badge = { icon: e.logo, label: e.title }
      pageByUrl.set(e.url, badge)
      pageByTitle.set(e.title, badge)
      continue
    }
    claim(byUrl, e.url, type)
    claim(byTitle, e.title, type)
  }
  const out = new Map<string, PageBadge>()
  for (const r of rows) {
    const recorded =
      r.resultType && r.resultType !== 'page' && r.resultType in TYPE_ICON
        ? (r.resultType as SearchType)
        : undefined
    const matched =
      (r.url ? byUrl.get(r.url) : undefined) || byTitle.get(r.name) || undefined
    const type = recorded ?? matched
    if (type && type !== 'page') {
      out.set(r.name, { icon: TYPE_ICON[type], label: TYPE_LABEL[type] })
      continue
    }
    const page =
      (r.url ? pageByUrl.get(r.url) : undefined) ?? pageByTitle.get(r.name)
    if (page) out.set(r.name, page)
  }
  return out
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

const EVENT_LABELS: Record<string, string> = {
  chatbot_open: 'Opened the chatbot',
  chatbot_message: 'Sent a message',
  chatbot_click: 'Clicked a result',
  analytics_optout: 'Turned analytics off',
  analytics_optin: 'Turned analytics back on',
}

/** Feed lines for search opens, by how the modal was opened. */
const SEARCH_OPEN_LABELS: Record<string, string> = {
  button: 'Opened search',
  'cmd-k': 'Opened search (⌘K)',
  slash: 'Opened search (/)',
}

function pillFor(e: { page?: string; type: string }): string | null {
  // Chatbot/search first: their events carry the page they happened on too,
  // but in the feed they should read as chatbot/search activity, not clicks.
  if (e.type.startsWith('chatbot')) return 'Chatbot'
  if (e.type.startsWith('search')) return 'Search'
  if (e.page) return e.page
  return null
}

function labelFor(e: {
  label?: string
  type: string
  source?: string
  query?: string
}): string {
  if (e.type === 'search_open')
    return SEARCH_OPEN_LABELS[e.source ?? ''] ?? 'Opened search'
  if (e.type === 'search_query')
    return e.query ? `Searched for “${e.query}”` : 'Searched'
  // search_click carries the result's title as its label, like listing clicks.
  return e.label ?? EVENT_LABELS[e.type] ?? e.type
}

/** Conversion percentage of one funnel stage relative to the previous. */
function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((100 * part) / whole)}%` : '—'
}

/** A share of `total` to one decimal place, e.g. "43.2%". */
function pct1(part: number, total: number): string {
  return `${((100 * part) / total).toFixed(1)}%`
}

/** "1 July 2026" in the dashboard's timezone, for the coverage note. */
function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/** "July 2026" for a storage month ('2026-07'), for the near-cap warning. */
function formatMonth(month: string): string {
  try {
    return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return month
  }
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

  // The dashboard is tabbed: two overview tabs (the chatbot and the by-page
  // table) plus one tab per resource page. `tab` holds the active tab — an
  // overview key, or a resource page's analytics name. A resource tab is the
  // page we ask the store to drill into; the overview tabs need no page.
  // 'funnel' is the Chatbot tab's old key, kept working for bookmarked urls.
  const tabRaw = first(sp.tab)
  const tabReq = tabRaw === 'funnel' ? 'chatbot' : tabRaw
  const onResourceTab = tabReq != null && !OVERVIEW_KEYS.has(tabReq)

  const [data, funders, convStats, themes, searchIndex] = await Promise.all([
    readDashboard(
      range,
      onResourceTab ? tabReq : undefined,
      unique,
      first(sp.source)
    ),
    getFunders().catch(() => []),
    // The transcript-derived stats only render on the Chatbot tab, so only
    // fetch the (ever-growing) conversation log when it's the active tab.
    tabReq === 'chatbot' ? readConversationStats(range) : null,
    tabReq === 'chatbot' ? readQuestionThemes() : null,
    // Resolves clicked search results to their resource page; only the Search
    // tab reads it. On error the page icons resolve from recorded types alone.
    tabReq === 'search'
      ? buildSearchIndex().catch(() => [] as SearchEntry[])
      : ([] as SearchEntry[]),
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

  // When the selected range reaches back further than the stored data (or is
  // unbounded, like All time), say how far back the data actually goes — so a
  // range like "All time" can't quietly read as more history than exists.
  const oldestMs = data.oldestTs ? Date.parse(data.oldestTs) : NaN
  const showCoverage =
    !Number.isNaN(oldestMs) &&
    (range.startMs == null || range.startMs < oldestMs)

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
          {showCoverage && data.oldestTs && (
            <span
              className={styles.coverage}
              title={`The earliest stored event. Tracking launched on 20 June 2026; events before ${formatDay(data.oldestTs)} were deleted by an early 5,000-event storage cap. The cap has been removed, so nothing is deleted anymore.`}
            >
              data since {formatDay(data.oldestTs)}
            </span>
          )}
          <ExcludeToggle />
        </div>
      </div>

      {data.nearCap.map(({ month, count, cap }) => (
        <div key={month} className={styles.capWarning}>
          ⚠ {formatMonth(month)} already holds {count.toLocaleString()} events –{' '}
          {Math.round((100 * count) / cap)}% of the {cap.toLocaleString()}
          -per-month safety cap. At the cap, the month&apos;s oldest events
          start being deleted. If this is real traffic rather than abuse, raise
          the cap now (MONTH_CAP in the analytics code) so nothing is lost.
        </div>
      ))}

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

          {activeTab === 'chatbot' && (
            <ChatbotView
              funnel={data.funnel}
              opensByPage={data.chatbot.opensByPage}
              destinations={data.chatbot.destinations}
              conv={convStats}
              themes={themes}
              unique={unique}
            />
          )}

          {activeTab === 'search' && (
            <SearchView
              search={data.search}
              index={searchIndex}
              unique={unique}
            />
          )}

          {activeTab === 'correlations' && (
            <Panel title="Shared interests">
              <CorrelationsTable
                rows={data.correlations}
                labelFor={name => labelByPage.get(name) ?? name}
              />
              <p className={styles.caption}>
                Visitors (by anonymous browser id) who engaged with both of a
                pair — visited the page or clicked one of its listings, with
                chatbot and search use as rows of their own. Clicks give this
                history back to 20 June 2026; page views count from 15 July
                2026, so overlaps get richer as views accumulate. Pairs shared
                by only one visitor are hidden.
              </p>
            </Panel>
          )}

          {activeTab === 'pages' && (
            <Panel title="Site traffic">
              <div className={styles.funnel}>
                <Stat
                  label="Visitors"
                  value={data.visits.uniqueVisitors.toLocaleString()}
                />
                <Stat
                  label="Visits"
                  value={data.visits.visitCount.toLocaleString()}
                />
                <Stat
                  label="Page views"
                  value={data.visits.totalViews.toLocaleString()}
                />
                <Stat
                  label="Analytics opt-outs"
                  value={data.optOuts.off.toLocaleString()}
                />
              </div>
              <p className={styles.caption}>
                First-party numbers, so ad blockers can&apos;t strip them.
                Visitors = distinct browsers; one visitor&apos;s pages more than
                30 minutes apart count as separate visits. Recording since 15
                July 2026. Opt-outs = browsers that switched analytics off on
                the privacy page (recording since 16 July 2026)
                {data.optOuts.on > 0 &&
                  ` — ${data.optOuts.on.toLocaleString()} turned it back on`}
                .
              </p>
            </Panel>
          )}

          {activeTab === 'pages' && (
            <div className={styles.grid}>
              <Panel title="Visits by page">
                <CountTable
                  rows={data.visits.byPage.map(r => ({
                    ...r,
                    name: labelByPage.get(r.name) ?? r.name,
                  }))}
                  labelHead="Page"
                  countHead={unique ? 'Visitors' : 'Views'}
                  total={data.visits.byPage.reduce((s, r) => s + r.count, 0)}
                />
                <p className={styles.caption}>
                  First-party page views — ad blockers can&apos;t strip these,
                  unlike Matomo&apos;s. Recording since 15 July 2026.
                </p>
              </Panel>
              <Panel title="Clicks by page">
                <CountTable
                  rows={data.byPage}
                  labelHead="Page"
                  total={totalClicks}
                />
              </Panel>
            </div>
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

// Hard ceiling on rows a listings table sends to the browser. Real catalogs
// are a few hundred listings, so organic data never comes near it; it exists
// so a flood of fabricated distinct labels through the public track endpoint
// can't balloon the page payload (every row crosses the server→client
// boundary, hidden rows included). Truncation is announced, never silent.
const MAX_TABLE_ROWS = 1000

function TruncationNote({ shown, of }: { shown: number; of: number }) {
  return (
    <p className={styles.dim}>
      Showing the {shown.toLocaleString()} most-clicked of {of.toLocaleString()}{' '}
      listings.
    </p>
  )
}

function CountTable({
  rows: allRows,
  labelHead,
  countHead = 'Clicks',
  rankHead = '#',
  logoFor,
  linkFor,
  rankFor,
  pageFor,
  total,
}: {
  rows: Counted[]
  labelHead: string
  /** Heading for the count column — 'Clicks' unless the rows count something
   *  else (opens, conversations, …). */
  countHead?: string
  rankHead?: string
  logoFor?: (name: string) => string | undefined
  /** Destination url for a row's logo. When set, the logo becomes a link to the
   *  listing; the name text is deliberately left unlinked so it stays
   *  selectable/copyable. */
  linkFor?: (name: string) => string | undefined
  rankFor?: (name: string) => string | undefined
  /** When set, adds a Page column: the resource page each row belongs to,
   *  shown as the page's nav icon and name. */
  pageFor?: (name: string) => PageBadge | undefined
  /** When set, adds a % column (each row's share of this total) and a Total
   *  footer row. The total is the denominator, so for a sliced "top N" table it
   *  can exceed the sum of the visible rows. */
  total?: number
}) {
  if (allRows.length === 0) return <p className={styles.dim}>No data yet.</p>
  const rows = allRows.slice(0, MAX_TABLE_ROWS)
  const showPct = total != null && total > 0
  const colSpan = (rankFor ? 1 : 0) + 2 + (pageFor ? 1 : 0) + (showPct ? 1 : 0)
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            {rankFor && <th className={styles.rankCol}>{rankHead}</th>}
            <th>{labelHead}</th>
            {pageFor && <th>Page</th>}
            <th className={styles.numCol}>{countHead}</th>
            {showPct && <th className={styles.pctCol}>%</th>}
          </tr>
        </thead>
        <ExpandableBody colSpan={colSpan}>
          {rows.map((r, i) => {
            const rank = rankFor?.(r.name)
            const featured = rank?.startsWith('F')
            const href = linkFor?.(r.name)
            const badge = pageFor?.(r.name)
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
                {pageFor && (
                  <td>
                    {badge && (
                      <span className={styles.pageBadge}>
                        {badge.icon && (
                          <span className={styles.pageTabIcon}>
                            <Image
                              src={badge.icon}
                              alt=""
                              width={12}
                              height={12}
                            />
                          </span>
                        )}
                        {badge.label}
                      </span>
                    )}
                  </td>
                )}
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
              {pageFor && <td />}
              <td className={styles.numCol}>{total.toLocaleString()}</td>
              {showPct && (
                <td className={styles.pctCol}>{pct1(total, total)}</td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
      {allRows.length > rows.length && (
        <TruncationNote shown={rows.length} of={allRows.length} />
      )}
    </>
  )
}

/** The Overview tab's site-wide listings leaderboard. Like CountTable, but each
 *  row carries the page it came from (shown as a pill) and always uses a favicon
 *  — listings here span every page, so there's no single page's logos to load.
 *  `total` is every page's click count, so the top-N rows can sum to less than
 *  it; the Total footer shows the true denominator. */
function OverallListingsTable({
  rows: allRows,
  total,
}: {
  rows: (OverallListingRow & { pageLabel?: string })[]
  total: number
}) {
  if (allRows.length === 0) return <p className={styles.dim}>No data yet.</p>
  const rows = allRows.slice(0, MAX_TABLE_ROWS)
  const showPct = total > 0
  const colSpan = 3 + (showPct ? 1 : 0)
  return (
    <>
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
      {allRows.length > rows.length && (
        <TruncationNote shown={rows.length} of={allRows.length} />
      )}
    </>
  )
}

/** The Chatbot tab: the unique-user funnel, where and how the panel gets
 *  opened (first-party events, so they honour the date range and count mode),
 *  transcript-derived conversation stats (the Airtable conversation log), and
 *  what visitors click out of replies. */
function ChatbotView({
  funnel,
  opensByPage,
  destinations,
  conv,
  themes,
  unique,
}: {
  funnel: ChatbotFunnel
  opensByPage: Counted[]
  destinations: ClickDestination[]
  conv: ConversationStats | null
  themes: ThemeSummary | null
  unique: boolean
}) {
  const usersHead = unique ? 'Users' : undefined
  const sum = (rows: Counted[]) => rows.reduce((s, r) => s + r.count, 0)
  // Card clicks store only a url (no link text) — those rows read better as a
  // prettified url than a raw one.
  const destRows = destinations.map(d => ({
    ...d,
    name: d.url && d.name === d.url ? prettyUrl(d.url) : d.name,
  }))
  const destUrlByName = new Map(destRows.map(d => [d.name, d.url]))
  const medianLength =
    conv?.medianLength == null ? '—' : String(conv.medianLength)
  const share = (s: number | null) =>
    s == null ? '—' : `${Math.round(100 * s)}%`
  return (
    <>
      <Panel title="Funnel · unique users">
        <Funnel
          stages={[
            { label: 'Opened', value: funnel.opened },
            { label: 'Sent a message', value: funnel.typed },
            { label: 'Clicked a result', value: funnel.clicked },
          ]}
        />
      </Panel>

      <div className={styles.grid}>
        <Panel title="Where it's opened">
          <CountTable
            rows={opensByPage}
            labelHead="Page"
            countHead={usersHead ?? 'Opens'}
            total={sum(opensByPage)}
          />
          <p className={styles.caption}>
            The page visitors were on when they opened the chat panel.
          </p>
        </Panel>
        {conv?.available && (
          <Panel title="Conversations">
            <div className={styles.statStack}>
              <Stat
                label="Conversations"
                value={conv.totalConversations.toLocaleString()}
              />
              <Stat label="Median messages sent" value={medianLength} />
              <Stat
                label="of conversations started from a suggested question"
                value={share(conv.suggestedShare)}
              />
              <Stat
                label="of messages were a follow-up suggestion (conversation starters excluded)"
                value={share(conv.followUpMessageShare)}
              />
              <Stat
                label="of conversations included a card or link click"
                value={share(conv.clickedShare)}
              />
            </div>
            <p className={styles.caption}>
              From the conversation log (every message since the chatbot
              launched on 7 June 2026), for conversations started in the
              selected date range. These panels count conversations, so the
              Unique/Total toggle doesn&apos;t apply to them.
            </p>
          </Panel>
        )}
      </div>

      {conv && !conv.available && (
        <div className={styles.empty}>
          Couldn&apos;t reach the conversation log just now, so the conversation
          panels are hidden — try refreshing in a moment.
        </div>
      )}

      {conv?.available && (
        <>
          <div className={styles.grid}>
            <Panel title="Conversation length">
              <CountTable
                rows={conv.lengthBuckets}
                labelHead="Length"
                countHead="Conversations"
                total={sum(conv.lengthBuckets)}
              />
              <p className={styles.caption}>
                How many messages the visitor sent in each conversation.
              </p>
            </Panel>
            <Panel title="Languages">
              <CountTable
                rows={conv.languages}
                labelHead="Language"
                countHead="Conversations"
                total={sum(conv.languages)}
              />
              <p className={styles.caption}>
                Auto-detected from the visitor&apos;s messages, so approximate —
                conversations too short to call show as Unknown.
              </p>
            </Panel>
          </div>

          <Panel title="What people ask about">
            <ThemesTable summary={themes} />
            <p className={styles.caption}>
              <RefreshThemesButton />{' '}
              {themes && <>Last updated {formatTime(themes.generatedAt)}.</>}
            </p>
            <p className={styles.caption}>
              Every typed question since the chatbot launched (suggested-chip
              clicks excluded), grouped into themes by Claude. Always covers the
              whole log — the date range doesn&apos;t filter it — and
              regenerates weekly, or whenever it&apos;s refreshed.
            </p>
          </Panel>

          <Panel title="Suggested questions">
            <QuestionsTable
              rows={conv.topQuestions.filter(q => q.suggested)}
              showPill={false}
            />
            <p className={styles.caption}>
              How often each pre-written question chip started a conversation.
            </p>
          </Panel>
        </>
      )}

      <Panel title="Clicked from replies">
        <CountTable
          rows={destRows}
          labelHead="Destination"
          countHead={usersHead ?? 'Clicks'}
          logoFor={name => faviconFor(destUrlByName.get(name))}
          linkFor={name => destUrlByName.get(name)}
          total={sum(destRows)}
        />
        <p className={styles.caption}>
          The listing cards and links visitors opened from the chatbot&apos;s
          replies.
        </p>
      </Panel>
    </>
  )
}

/** The Search tab: how often site search gets used (and how it's opened),
 *  what people search for, which searches come back empty, and what gets
 *  clicked out of the results. */
function SearchView({
  search,
  index,
  unique,
}: {
  search: SearchPanelData
  index: SearchEntry[]
  unique: boolean
}) {
  const usersHead = unique ? 'Users' : undefined
  const sum = (rows: Counted[]) => rows.reduce((s, r) => s + r.count, 0)
  // Rows whose click carried no title read better as a prettified url.
  const destRows = search.destinations.map(d => ({
    ...d,
    name: d.url && d.name === d.url ? prettyUrl(d.url) : d.name,
  }))
  const destUrlByName = new Map(destRows.map(d => [d.name, d.url]))
  const pageBadges = searchPageBadges(index, destRows)
  return (
    <>
      <Panel title="Funnel · unique users">
        <Funnel
          stages={[
            { label: 'Opened search', value: search.funnel.opened },
            { label: 'Typed a search', value: search.funnel.searched },
            { label: 'Clicked a result', value: search.funnel.clicked },
          ]}
        />
        <p className={styles.caption}>Recording since 16 July 2026.</p>
      </Panel>

      <div className={styles.grid}>
        <Panel title="How it's opened">
          <CountTable
            rows={search.openMethods}
            labelHead="Method"
            countHead={usersHead ?? 'Opens'}
            total={sum(search.openMethods)}
          />
          <p className={styles.caption}>
            The magnifying-glass button, or a keyboard shortcut (⌘K also counts
            Ctrl+K).
          </p>
        </Panel>
        <Panel title="Where it's opened">
          <CountTable
            rows={search.opensByPage}
            labelHead="Page"
            countHead={usersHead ?? 'Opens'}
            total={sum(search.opensByPage)}
          />
          <p className={styles.caption}>
            The page visitors were on when they opened search.
          </p>
        </Panel>
      </div>

      <div className={styles.grid}>
        <Panel title="What people search for">
          <CountTable
            rows={search.topQueries}
            labelHead="Search"
            countHead={usersHead ?? 'Searches'}
            total={sum(search.topQueries)}
          />
          <p className={styles.caption}>
            A search is recorded once the visitor pauses typing, so a few
            half-typed words are normal.
          </p>
        </Panel>
        <Panel title="Searches with no results">
          <CountTable
            rows={search.noResultQueries}
            labelHead="Search"
            countHead={usersHead ?? 'Searches'}
            total={sum(search.noResultQueries)}
          />
          <p className={styles.caption}>
            What visitors looked for and didn&apos;t find — worth scanning for
            things the site should cover.
          </p>
        </Panel>
      </div>

      <Panel title="Clicked from search">
        <CountTable
          rows={destRows}
          labelHead="Result"
          countHead={usersHead ?? 'Clicks'}
          logoFor={name => faviconFor(destUrlByName.get(name))}
          linkFor={name => destUrlByName.get(name)}
          pageFor={name => pageBadges.get(name)}
          total={sum(destRows)}
        />
        <p className={styles.caption}>
          The results visitors opened from search, with the page or listing each
          one leads to. The Page column is the page the result belongs to; a row
          without one can&apos;t be matched to a single page in the search index.
        </p>
      </Panel>
    </>
  )
}

/** One stat in the Conversations row — reuses the funnel-stage styling so the
 *  row reads like the funnel above it. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.funnelStage}>
      <div className={styles.funnelValue}>{value}</div>
      <div className={styles.funnelLabel}>{label}</div>
    </div>
  )
}

/** Question rows with counts; the pill marks suggested-chip matches (off when
 *  the table already holds only suggested questions). */
function QuestionsTable({
  rows: allRows,
  showPill = true,
}: {
  rows: TopQuestion[]
  showPill?: boolean
}) {
  if (allRows.length === 0) return <p className={styles.dim}>No data yet.</p>
  const rows = allRows.slice(0, MAX_TABLE_ROWS)
  const total = allRows.reduce((s, r) => s + r.count, 0)
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Question</th>
            <th className={styles.numCol}>Conversations</th>
            <th className={styles.pctCol}>%</th>
          </tr>
        </thead>
        <ExpandableBody colSpan={3}>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={styles.nameCell}>
                <span>{r.text}</span>
                {showPill && r.suggested && (
                  <span className={styles.pill}>Suggested</span>
                )}
              </td>
              <td className={styles.numCol}>{r.count.toLocaleString()}</td>
              <td className={styles.pctCol}>{pct1(r.count, total)}</td>
            </tr>
          ))}
        </ExpandableBody>
        <tfoot>
          <tr className={styles.totalRow}>
            <td className={styles.totalLabel}>Total</td>
            <td className={styles.numCol}>{total.toLocaleString()}</td>
            <td className={styles.pctCol}>{pct1(total, total)}</td>
          </tr>
        </tfoot>
      </table>
      {allRows.length > rows.length && (
        <TruncationNote shown={rows.length} of={allRows.length} />
      )}
    </>
  )
}

/** Claude-generated question themes with counts and verbatim examples. */
function ThemesTable({ summary }: { summary: ThemeSummary | null }) {
  if (!summary || summary.themes.length === 0) {
    return (
      <p className={styles.dim}>
        No summary yet — refresh to generate one (it runs weekly on its own).
      </p>
    )
  }
  const total = summary.totalQuestions
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Theme</th>
          <th className={styles.numCol}>Conversations</th>
          <th className={styles.pctCol}>%</th>
        </tr>
      </thead>
      <tbody>
        {summary.themes.map((t, i) => (
          <tr key={i}>
            <td>
              <div>{t.name}</div>
              {t.examples.length > 0 && (
                <div className={styles.dim}>
                  {t.examples.map(e => `“${e}”`).join(' · ')}
                </div>
              )}
            </td>
            <td className={styles.numCol}>{t.count.toLocaleString()}</td>
            <td className={styles.pctCol}>{pct1(t.count, total)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className={styles.totalRow}>
          <td className={styles.totalLabel}>Total</td>
          <td className={styles.numCol}>{total.toLocaleString()}</td>
          <td className={styles.pctCol}>{pct1(total, total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

/** Cross-interest overlaps, one row per pair of pages (or page + chatbot),
 *  most-shared first. */
function CorrelationsTable({
  rows: allRows,
  labelFor,
}: {
  rows: CorrelationRow[]
  labelFor: (name: string) => string
}) {
  if (allRows.length === 0) {
    return (
      <p className={styles.dim}>
        No overlaps in this range yet — they build up as visitors move between
        pages.
      </p>
    )
  }
  const rows = allRows.slice(0, MAX_TABLE_ROWS)
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Pages</th>
          <th className={styles.numCol}>Shared visitors</th>
          <th>Overlap</th>
        </tr>
      </thead>
      <ExpandableBody colSpan={3}>
        {rows.map((r, i) => {
          const a = labelFor(r.a)
          const b = labelFor(r.b)
          return (
            <tr key={i}>
              <td className={styles.nameCell}>
                <span>
                  {a} + {b}
                </span>
              </td>
              <td className={styles.numCol}>{r.both.toLocaleString()}</td>
              <td>
                {pct1(r.both, r.aTotal)} of {a} · {pct1(r.both, r.bTotal)} of{' '}
                {b}
              </td>
            </tr>
          )
        })}
      </ExpandableBody>
    </table>
  )
}

/** A row of funnel stages, with each arrow showing the conversion from the
 *  stage before it. */
function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  return (
    <div className={styles.funnel}>
      {stages.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && <FunnelArrow pct={pct(s.value, stages[i - 1].value)} />}
          <FunnelStage label={s.label} value={s.value} />
        </Fragment>
      ))}
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
