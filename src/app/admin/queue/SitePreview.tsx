'use client'

import ListingCard, {
  type ListingCardMeta,
  type ListingCardPill,
} from '@/components/ListingCard'
import styles from './queue.module.css'

// "How it will look on the site": the proposed record rendered with the
// public ListingCard, on the site's dark ground, so Bryce can judge a card
// the way a visitor will see it (his ask, 9 Sept 2026). The mapping from raw
// Airtable field names to card parts is a best effort shared by every
// resource page — close enough to visualise, not the page's exact logic.

const NAME_KEYS = /\b(name|title)\b|^organi[sz]ation$/i
const DESC_KEYS = /^description( \(short\))?$|^short description$/i
const ANY_DESC = /description/i
const LOGO_KEYS = /logo/i
const PILL_KEYS =
  /^(type|mode|platform|categor(y|ies)|status|format|topics?|level|entry bar|funding type|kind)$/i
const DATE_KEYS = /^(start date|date|deadline|end date)$/i

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function list(v: unknown): string[] {
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === 'string')
  const s = str(v)
  return s ? [s] : []
}

function firstMatch(fields: Record<string, unknown>, re: RegExp): unknown {
  for (const [k, v] of Object.entries(fields)) if (re.test(k)) return v
  return undefined
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SitePreview({
  page,
  fields,
  edits,
}: {
  page: string | null
  fields: Record<string, unknown>
  edits: Record<string, string>
}) {
  const f: Record<string, unknown> = { ...fields, ...edits }
  const name = str(firstMatch(f, NAME_KEYS)) ?? '(no name)'
  const description =
    str(firstMatch(f, DESC_KEYS)) ?? str(firstMatch(f, ANY_DESC)) ?? ''
  const logoRaw = firstMatch(f, LOGO_KEYS)
  const logo = list(logoRaw)[0] ?? null

  const pills: ListingCardPill[] = []
  for (const [k, v] of Object.entries(f)) {
    if (PILL_KEYS.test(k)) for (const label of list(v)) pills.push({ label })
  }

  const titleMeta: ListingCardMeta[] = []
  const mode = str(f['Mode'])
  const location = str(f['Location'])
  if (mode && /online/i.test(mode) && !location) {
    titleMeta.push({ icon: '/images/icons/computer.svg', value: 'Online' })
  } else if (location) {
    titleMeta.push({ icon: '/images/icons/pin.svg', value: location })
  }
  const start = str(f['Start date'])
  const end = str(f['End date'])
  if (start) {
    titleMeta.push({
      icon: '/images/icons/calendar.svg',
      value:
        end && end !== start
          ? `${fmtDate(start)} – ${fmtDate(end)}`
          : fmtDate(start),
    })
  } else {
    const anyDate = str(firstMatch(f, DATE_KEYS))
    if (anyDate)
      titleMeta.push({
        icon: '/images/icons/calendar.svg',
        value: fmtDate(anyDate),
      })
  }

  const meta: ListingCardMeta[] = []
  const host =
    str(f['Host name']) ??
    str(f['Host']) ??
    str(f['Organisation']) ??
    str(f['Organization'])
  if (host) meta.push({ icon: '/images/icons/person.svg', value: `By ${host}` })
  const cost = list(f['Cost'])
  if (cost.length)
    meta.push({ icon: '/images/icons/tag.svg', value: cost.join(', ') })
  const deadline = str(f['Deadline'])
  if (deadline)
    meta.push({
      icon: '/images/icons/paper.svg',
      value: `Apply by ${fmtDate(deadline)}`,
    })
  const amount =
    str(f['Amount']) ?? str(f['Grant size']) ?? str(f['Funding amount'])
  if (amount) meta.push({ icon: '/images/icons/coins.svg', value: amount })

  return (
    <section className={styles.block}>
      <h3 className={styles.h3}>On {page ?? 'the site'}</h3>
      <div className={styles.siteFrame}>
        <ListingCard
          name={name}
          description={description}
          logo={logo}
          pills={pills.slice(0, 3)}
          titleMeta={titleMeta}
          meta={meta}
          trackingPage="admin-queue"
        />
      </div>
      {!logo && <p className={styles.note}>No logo on the record yet.</p>}
    </section>
  )
}
