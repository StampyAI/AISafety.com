'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import { trackListingClick } from '@/lib/analytics'
import { formatDate } from '@/lib/format-date'
import type { EventListing } from '@/lib/data/events'
import NewsletterSignupCard from './NewsletterSignupCard'
import styles from './page.module.css'

const SUGGEST_LISTING_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form'
const SUGGEST_CORRECTION_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form'

const applicationStatusOptions = ['Open', 'Closed']
const formatOptions = ['Online', 'In person', 'Hybrid']
const costOptions = ['Free', 'Paid', 'Paid (Stipend Available)']
const eventTypeOptions = [
  'Competition',
  'Conference',
  'Meetup',
  'Talk',
  'Workshop',
]

interface EventsClientProps {
  events: EventListing[]
  lastUpdated: string | null
}

function eventDateLabel(event: EventListing): string | null {
  if (!event.startDate) return null
  return formatDate(new Date(event.startDate))
}

function matchesAny(value: string | string[], selected: string[]): boolean {
  if (selected.length === 0) return true
  const haystack = Array.isArray(value)
    ? value.map(v => v.toLowerCase())
    : [value.toLowerCase()]
  return selected.some(s => haystack.some(v => v.includes(s.toLowerCase())))
}

export default function EventsClient({
  events,
  lastUpdated,
}: EventsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedFormat, setSelectedFormat] = useState<string[]>([])
  const [selectedCost, setSelectedCost] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<string[]>([])
  const savedScrollY = useRef<number | null>(null)

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !event.name.toLowerCase().includes(q) &&
          !event.location.toLowerCase().includes(q) &&
          !event.description.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      if (!matchesAny(event.applicationStatus, selectedStatus)) return false
      if (!matchesAny(event.format, selectedFormat)) return false
      if (!matchesAny(event.cost, selectedCost)) return false
      if (!matchesAny(event.type, selectedType)) return false
      return true
    })
  }, [
    events,
    searchQuery,
    selectedStatus,
    selectedFormat,
    selectedCost,
    selectedType,
  ])

  const featuredEvents = useMemo(
    () => events.filter(e => e.featured).slice(0, 4),
    [events]
  )
  const featuredBanner = featuredEvents[0]
  const featuredRest = featuredEvents.slice(1, 4)

  const counts = useMemo(() => {
    function countBy(
      getter: (e: EventListing) => string | string[],
      options: string[]
    ) {
      return events.reduce(
        (acc, event) => {
          const value = getter(event)
          const haystack = Array.isArray(value)
            ? value.map(v => v.toLowerCase())
            : [value.toLowerCase()]
          for (const o of options) {
            if (haystack.some(v => v.includes(o.toLowerCase()))) {
              acc[o] = (acc[o] || 0) + 1
            }
          }
          return acc
        },
        {} as Record<string, number>
      )
    }
    return {
      status: countBy(e => e.applicationStatus, applicationStatusOptions),
      format: countBy(e => e.format, formatOptions),
      cost: countBy(e => e.cost, costOptions),
      type: countBy(e => e.type, eventTypeOptions),
    }
  }, [events])

  const toggleFilter = (
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) => {
    savedScrollY.current = window.scrollY
    if (current.includes(value)) {
      setter(current.filter(v => v !== value))
    } else {
      setter([...current, value])
    }
  }

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredEvents])

  const activeChips: { label: string; remove: () => void }[] = [
    ...selectedStatus.map(s => ({
      label: `Application status: ${s}`,
      remove: () => setSelectedStatus(selectedStatus.filter(x => x !== s)),
    })),
    ...selectedFormat.map(f => ({
      label: `Format: ${f}`,
      remove: () => setSelectedFormat(selectedFormat.filter(x => x !== f)),
    })),
    ...selectedCost.map(c => ({
      label: `Cost: ${c}`,
      remove: () => setSelectedCost(selectedCost.filter(x => x !== c)),
    })),
    ...selectedType.map(t => ({
      label: `Type: ${t}`,
      remove: () => setSelectedType(selectedType.filter(x => x !== t)),
    })),
  ]

  return (
    <>
      {/* ----- Hero ----- */}
      <section className={styles.hero}>
        <div className={styles['hero-left']}>
          <h1 className={styles['hero-title']}>
            Events
            {events.length > 0 && (
              <span className={styles['hero-count']}>
                {events.length} listings
              </span>
            )}
          </h1>
          {lastUpdated && (
            <p className="paragraph-small color-teal-300 margin-bottom-24px">
              Last updated: {lastUpdated}
            </p>
          )}
          <h2 className={styles['hero-subtitle']}>
            Find conferences, competitions, meetups, talks, and workshops in AI
            safety, both online and in-person.
          </h2>
          <a href="/training" className={styles['training-link']}>
            For training opportunities such as bootcamps, courses, internships,
            and research programs, go to Training →
          </a>
          <p className={styles['hero-search-label']}>
            Find events in your city
          </p>
          <div className={styles['search-field-wrap']}>
            <span className={styles['search-field-icon-left']}>
              <Image
                src="/images/location-pin.svg"
                alt=""
                width={20}
                height={20}
              />
            </span>
            <input
              type="text"
              className="text-field"
              placeholder="Search by location, e.g. San Francisco"
              maxLength={256}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <span className={styles['search-field-icon-right']}>
              <Image src="/images/search.svg" alt="" width={20} height={20} />
            </span>
          </div>
        </div>
        <div className={styles['hero-right']}>
          <div className={styles['suggest-block']}>
            <p className={styles['suggest-prompt']}>
              Want to get your event on this page?
            </p>
            <div className={styles['suggest-row']}>
              <a
                href={SUGGEST_LISTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles['suggest-link']}
              >
                <Image
                  src="/images/plus-circle.svg"
                  alt=""
                  width={16}
                  height={16}
                />
                Suggest listing
              </a>
              <a
                href={SUGGEST_CORRECTION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles['suggest-link']}
              >
                <Image src="/images/pencil.svg" alt="" width={16} height={16} />
                Suggest correction
              </a>
            </div>
          </div>
          <NewsletterSignupCard />
        </div>
      </section>

      {/* ----- Featured Events ----- */}
      {featuredEvents.length > 0 && (
        <section className={styles['featured-section']}>
          <h2 className={styles['featured-heading']}>Featured Events</h2>
          {featuredBanner && (
            <a
              href={featuredBanner.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles['featured-banner']}
              onClick={() =>
                trackListingClick(
                  'Events',
                  featuredBanner.name,
                  featuredBanner.url
                )
              }
            >
              <div className={styles['featured-banner-image']}>
                {featuredBanner.image && (
                  <Image
                    src={featuredBanner.image}
                    alt=""
                    fill
                    sizes="480px"
                    unoptimized
                  />
                )}
              </div>
              <div className={styles['featured-banner-body']}>
                <h3 className={styles['featured-banner-title']}>
                  {featuredBanner.name}
                </h3>
                {featuredBanner.description && (
                  <p className={styles['featured-banner-desc']}>
                    {featuredBanner.description}
                  </p>
                )}
                <EventMetaLine event={featuredBanner} />
              </div>
            </a>
          )}
          {featuredRest.length > 0 && (
            <div className={styles['featured-row']}>
              {featuredRest.map(event => (
                <a
                  key={event.id}
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles['featured-card']}
                  onClick={() =>
                    trackListingClick('Events', event.name, event.url)
                  }
                >
                  <div>
                    <h3 className={styles['featured-card-title']}>
                      {event.name}
                    </h3>
                    {event.description && (
                      <p className={styles['featured-card-desc']}>
                        {event.description}
                      </p>
                    )}
                  </div>
                  <EventMetaLine event={event} />
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ----- Main events grid + filter sidebar ----- */}
      <section className="database-outer-grid">
        <div>
          {activeChips.length > 0 && (
            <div className={styles['filter-chips-row']}>
              {activeChips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={chip.remove}
                  className={styles['filter-chip']}
                >
                  {chip.label}
                  <span className={styles['filter-chip-remove']}>×</span>
                </button>
              ))}
            </div>
          )}

          <div className="collection-list padding-bottom-40px">
            {filteredEvents.map(event => (
              <a
                key={event.id}
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles['event-card']}
                onClick={() =>
                  trackListingClick('Events', event.name, event.url)
                }
              >
                <h3 className={styles['event-card-title']}>{event.name}</h3>
                {event.description && (
                  <p className={styles['event-card-desc']}>
                    {event.description}
                  </p>
                )}
                <div className={styles['event-card-bottom']}>
                  <EventMetaLine event={event} />
                </div>
              </a>
            ))}
            {filteredEvents.length === 0 && (
              <p className="paragraph-small color-teal-300">No events found.</p>
            )}
          </div>
        </div>

        <div className="hide-mobile">
          <p className={styles['filter-sidebar-title']}>Filter events</p>
          <FilterSidebar>
            <FilterGroup
              title="Application status"
              options={applicationStatusOptions}
              selected={selectedStatus}
              counts={counts.status}
              onToggle={v => toggleFilter(v, selectedStatus, setSelectedStatus)}
            />
            <FilterGroup
              title="Format"
              options={formatOptions}
              selected={selectedFormat}
              counts={counts.format}
              onToggle={v => toggleFilter(v, selectedFormat, setSelectedFormat)}
            />
            <FilterGroup
              title="Cost"
              options={costOptions}
              selected={selectedCost}
              counts={counts.cost}
              onToggle={v => toggleFilter(v, selectedCost, setSelectedCost)}
            />
            <FilterGroup
              title="Event type"
              options={eventTypeOptions}
              selected={selectedType}
              counts={counts.type}
              onToggle={v => toggleFilter(v, selectedType, setSelectedType)}
            />
          </FilterSidebar>
        </div>
      </section>
    </>
  )
}

function EventMetaLine({ event }: { event: EventListing }) {
  const dateLabel = eventDateLabel(event)
  const parts = [
    event.location || null,
    dateLabel,
    event.cost.length > 0 ? event.cost[0] : null,
  ].filter(Boolean) as string[]

  if (parts.length === 0) return null

  return (
    <div className={styles['event-meta']}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className={styles['event-meta-dot']}> · </span>}
          {part}
        </span>
      ))}
    </div>
  )
}
