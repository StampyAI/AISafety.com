import ListingCard from '@/components/ListingCard'
import FeaturedCard from '@/components/FeaturedCard'
import ContributeButtons from '@/components/ContributeButtons'
import { eventTypeColor } from '@/lib/event-types'
import type { EventListing } from '@/lib/data/events'
import styles from './page.module.css'

const ADD_EVENT_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form'
const SUGGEST_CORRECTION_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form'
const AIRTABLE_VIEW_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/shrLgl03tMK4q6cyc/tblx0L8qJEaLBxJFS?viewControls=on'

interface EventsClientProps {
  events: EventListing[]
}

function parseISO(date: string): Date {
  return new Date(date + 'T00:00:00Z')
}
function shortMonth(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  }).format(d)
}

function formatEventDate(
  startDate: string | null,
  endDate: string | null
): string | null {
  if (!startDate) return null
  const s = parseISO(startDate)
  const day = (d: Date) => d.getUTCDate()
  if (!endDate || endDate === startDate) {
    return `${day(s)} ${shortMonth(s)} ${s.getUTCFullYear()}`
  }
  const e = parseISO(endDate)
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear()
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth()
  if (sameMonth) {
    return `${day(s)} – ${day(e)} ${shortMonth(e)} ${e.getUTCFullYear()}`
  }
  if (sameYear) {
    return `${day(s)} ${shortMonth(s)} – ${day(e)} ${shortMonth(e)} ${e.getUTCFullYear()}`
  }
  return `${day(s)} ${shortMonth(s)} ${s.getUTCFullYear()} – ${day(e)} ${shortMonth(e)} ${e.getUTCFullYear()}`
}

function formatEventTime(
  startTime: string | null,
  endTime: string | null
): string | null {
  if (!startTime) return null
  return endTime ? `${startTime} – ${endTime}` : startTime
}

function monthKey(startDate: string | null): string {
  if (!startDate) return 'tbc'
  const d = parseISO(startDate)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, '0')}`
}
function monthLabel(startDate: string | null): string {
  if (!startDate) return 'Dates to be confirmed'
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseISO(startDate))
}

function titleMetaFor(event: EventListing) {
  const date = formatEventDate(event.startDate, event.endDate)
  const time = formatEventTime(event.startTime, event.endTime)
  const rows: { icon: string; value: string }[] = []
  if (event.location)
    rows.push({ icon: '/images/icons/pin.svg', value: event.location })
  if (date) rows.push({ icon: '/images/icons/calendar.svg', value: date })
  if (time) rows.push({ icon: '/images/icons/timer.svg', value: time })
  return rows
}

function bottomMetaFor(event: EventListing) {
  const rows: { icon: string; value: string }[] = []
  if (event.host)
    rows.push({ icon: '/images/icons/person.svg', value: `By ${event.host}` })
  if (event.cost.length > 0)
    rows.push({ icon: '/images/icons/tag.svg', value: event.cost.join(', ') })
  return rows
}

export default function EventsClient({ events }: EventsClientProps) {
  const featuredEvents = (['1', '2'] as const)
    .map(rank => events.find(e => e.featured === rank))
    .filter((e): e is EventListing => e != null)

  const monthGroups: { key: string; label: string; events: EventListing[] }[] =
    []
  for (const event of events) {
    const key = monthKey(event.startDate)
    let group = monthGroups.find(g => g.key === key)
    if (!group) {
      group = { key, label: monthLabel(event.startDate), events: [] }
      monthGroups.push(group)
    }
    group.events.push(event)
  }

  return (
    <>
      {featuredEvents.length > 0 && (
        <div className="flex flex-wrap gap-56px padding-bottom-80px">
          {featuredEvents.map((event, i) => (
            <FeaturedCard
              key={event.id}
              className="width-6-col"
              href={event.url !== '#' ? event.url : undefined}
              tagline={event.featuredTagline ?? 'Featured event'}
              name={event.name}
              description={event.description}
              logo={event.logo}
              accentClass={
                event.type[0] ? eventTypeColor(event.type[0]) : undefined
              }
              titleMeta={titleMetaFor(event)}
              meta={bottomMetaFor(event)}
              trackingPage="Events"
              index={i}
              count={featuredEvents.length}
            />
          ))}
        </div>
      )}

      <h2 className={styles.sectionHeading}>Upcoming events</h2>

      <div className="flex gap-56px padding-top-40px">
        <div className="width-9-col">
          {monthGroups.map(group => (
            <div key={group.key} className="padding-bottom-40px">
              <p className="paragraph-small color-teal-300 padding-bottom-24px">
                {group.label}
              </p>
              <div className="collection-list">
                {group.events.map(event => (
                  <ListingCard
                    key={event.id}
                    href={event.url}
                    name={event.name}
                    description={event.description}
                    logo={event.logo}
                    pills={event.type.map(t => ({
                      label: t,
                      colorClass: eventTypeColor(t),
                    }))}
                    titleMeta={titleMetaFor(event)}
                    meta={bottomMetaFor(event)}
                    trackingPage="Events"
                  />
                ))}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="paragraph-small color-teal-300">
              No upcoming events right now. Check back soon.
            </p>
          )}
        </div>

        <div className="hide-mobile width-3-col">
          <ContributeButtons
            suggestEntryUrl={ADD_EVENT_URL}
            suggestCorrectionUrl={SUGGEST_CORRECTION_URL}
            noun="event"
            airtableUrl={AIRTABLE_VIEW_URL}
          />
        </div>
      </div>
    </>
  )
}
