'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { trackListingClick } from '@/lib/analytics'
import { formatDate } from '@/lib/format-date'
import type { EventListing } from '@/lib/data/events'
import NewsletterSignupCard from './NewsletterSignupCard'
import styles from './page.module.css'

const SUGGEST_LISTING_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form'
const SUGGEST_CORRECTION_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form'
const AIRTABLE_VIEW_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/shrLgl03tMK4q6cyc/tblx0L8qJEaLBxJFS?viewControls=on'

const eventTypeOptions = [
  'Competition',
  'Conference',
  'Meetup',
  'Talk',
  'Workshop',
]
const costOptions = ['Free', 'Paid', 'Paid (Stipend Available)']
const applicationStatusOptions: ('Open' | 'Closed')[] = ['Open', 'Closed']

interface EventsClientProps {
  events: EventListing[]
  lastUpdated: string | null
}

function eventDateLabel(event: EventListing): string | null {
  if (!event.startDate) return null
  return formatDate(new Date(event.startDate))
}

export default function EventsClient({
  events,
  lastUpdated,
}: EventsClientProps) {
  const [filterType, setFilterType] = useState<string[]>([])
  const [filterCost, setFilterCost] = useState<string[]>([])
  const [filterLocation, setFilterLocation] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState<('Open' | 'Closed')[]>([
    'Open',
  ])

  const cityGroups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events) {
      const raw = e.location?.trim()
      if (!raw || raw.toLowerCase() === 'online') continue
      const city = raw.split(',')[0].trim()
      if (!city) continue
      counts.set(city, (counts.get(city) || 0) + 1)
    }
    const entries = Array.from(counts.entries())
    const popular = [...entries]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([c]) => c)
    const popularSet = new Set(popular)
    const rest = entries
      .map(([c]) => c)
      .filter(c => !popularSet.has(c))
      .sort((a, b) => a.localeCompare(b))
    return { popular, rest }
  }, [events])

  const locationOptions = useMemo(() => {
    return ['Online', ...cityGroups.popular, ...cityGroups.rest]
  }, [cityGroups])

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (
        filterType.length > 0 &&
        !event.type.some(t => filterType.includes(t))
      )
        return false
      if (
        filterCost.length > 0 &&
        !event.cost.some(c => filterCost.includes(c))
      )
        return false
      if (filterLocation.length > 0) {
        const loc = event.location.toLowerCase()
        const matches = filterLocation.some(l =>
          l === 'Online' ? loc === 'online' : loc.includes(l.toLowerCase())
        )
        if (!matches) return false
      }
      if (
        filterStatus.length > 0 &&
        !filterStatus.includes(event.applicationStatus)
      )
        return false
      return true
    })
  }, [events, filterType, filterCost, filterLocation, filterStatus])

  const featuredEvents = useMemo(() => {
    const explicit = events.filter(e => e.featured).slice(0, 2)
    if (explicit.length >= 2) return explicit
    return events.slice(0, 2)
  }, [events])

  return (
    <>
      {/* ----- Hero ----- */}
      <section className={styles.hero}>
        <div className={styles['hero-left']}>
          <h1 className={styles['hero-title']}>Events</h1>
          {lastUpdated && (
            <p className={`paragraph-small ${styles['hero-last-updated']}`}>
              Last updated: {lastUpdated}
            </p>
          )}
          <h2 className={styles['hero-subtitle']}>
            Find{' '}
            <span className="color-teal">
              conferences, competitions, meetups, talks, and workshops
            </span>{' '}
            in AI safety, both online and in-person.
          </h2>
          <a
            href="/training"
            className={`paragraph-small ${styles['training-link']}`}
          >
            For training opportunities such as bootcamps, courses, internships,
            and research programs, go to Training →
          </a>
        </div>
      </section>

      {/* ----- Featured Events ----- */}
      {featuredEvents.length > 0 && (
        <section className={styles['featured-section']}>
          <div className={styles['featured-row']}>
            {featuredEvents.map(event => (
              <EventCard key={event.id} event={event} featured />
            ))}
          </div>
        </section>
      )}

      {/* ----- Main events grid + suggest block ----- */}
      <section className="database-outer-grid">
        <div>
          <div className={`${styles['filter-row']} hide-mobile`}>
            <FilterSelect
              label="Applications"
              values={filterStatus}
              onChange={v => setFilterStatus(v as ('Open' | 'Closed')[])}
              options={applicationStatusOptions}
              showAllOption
            />
            <FilterSelect
              label="Location"
              values={filterLocation}
              onChange={setFilterLocation}
              options={locationOptions}
              showAllOption
            />
            <FilterSelect
              label="Event type"
              values={filterType}
              onChange={setFilterType}
              options={eventTypeOptions}
              showAllOption
            />
            <FilterSelect
              label="Cost"
              values={filterCost}
              onChange={setFilterCost}
              options={costOptions}
              showAllOption
            />
          </div>
          <AppliedFilters
            filters={[
              {
                label: 'Applications',
                values: filterStatus,
                clear: () => setFilterStatus([]),
              },
              {
                label: 'Location',
                values: filterLocation,
                clear: () => setFilterLocation([]),
              },
              {
                label: 'Event type',
                values: filterType,
                clear: () => setFilterType([]),
              },
              {
                label: 'Cost',
                values: filterCost,
                clear: () => setFilterCost([]),
              },
            ]}
            clearAll={() => {
              setFilterType([])
              setFilterCost([])
              setFilterLocation([])
              setFilterStatus([])
            }}
          />

          <MobileFilterPills
            groups={[
              {
                label: 'Applications',
                options: applicationStatusOptions,
                values: filterStatus,
                onChange: v => setFilterStatus(v as ('Open' | 'Closed')[]),
                showAllOption: true,
              },
              {
                label: 'Location',
                options: locationOptions,
                values: filterLocation,
                onChange: setFilterLocation,
                showAllOption: true,
              },
              {
                label: 'Event type',
                options: eventTypeOptions,
                values: filterType,
                onChange: setFilterType,
                showAllOption: true,
              },
              {
                label: 'Cost',
                options: costOptions,
                values: filterCost,
                onChange: setFilterCost,
                showAllOption: true,
              },
            ]}
            clearAll={() => {
              setFilterType([])
              setFilterCost([])
              setFilterLocation([])
              setFilterStatus([])
            }}
          />

          <div className="collection-list padding-bottom-40px">
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
            {filteredEvents.length === 0 && (
              <p className="paragraph-small color-teal-300">
                No results found. Try adjusting the filters.
              </p>
            )}
          </div>
        </div>

        <div className="hide-mobile">
          <NewsletterSignupCard />

          <div className={styles['contribute-card']}>
            <p
              className={`paragraph-xs color-cool-grey-500 ${styles['contribute-title']}`}
            >
              Contribute to this page
            </p>
            <a
              href={SUGGEST_LISTING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`paragraph-xs color-bright-teal-400 ${styles['contribute-link']}`}
            >
              <span className={styles['contribute-icon']}>
                <Image
                  src="/images/plus-circle-bright.svg"
                  alt=""
                  width={12}
                  height={12}
                />
              </span>
              Add a listing
            </a>
            <a
              href={SUGGEST_CORRECTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`paragraph-xs color-bright-teal-400 ${styles['contribute-link']}`}
            >
              <span className={styles['contribute-icon']}>
                <Image
                  src="/images/pencil-bright.svg"
                  alt=""
                  width={12}
                  height={12}
                />
              </span>
              Suggest a correction
            </a>
          </div>

          <a
            href={AIRTABLE_VIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles['airtable-card']}
          >
            <span className={styles['airtable-arrow']}>
              <Image
                src="/images/arrow-up-right.svg"
                alt=""
                width={16}
                height={16}
              />
            </span>
            <div className={styles['airtable-preview']} aria-hidden="true">
              <div className={styles['airtable-headers']}>
                <span className={styles['airtable-hdr-1']} />
                <span className={styles['airtable-hdr-2']} />
                <span className={styles['airtable-hdr-3']} />
                <span className={styles['airtable-hdr-4']} />
              </div>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={styles['airtable-row']}>
                  <span className={styles['airtable-row-num']}>{i + 1}</span>
                  <span className={styles['airtable-cell']} />
                  <span className={styles['airtable-cell']} />
                  <span className={styles['airtable-cell']} />
                  <span className={styles['airtable-cell']} />
                </div>
              ))}
            </div>
            <p className={`paragraph-xs ${styles['airtable-title']}`}>
              View data in Airtable
            </p>
          </a>
        </div>
      </section>
    </>
  )
}

function FilterSelect({
  label,
  values,
  onChange,
  options,
  showAllOption = false,
}: {
  label: string
  values: readonly string[]
  onChange: (next: string[]) => void
  options: readonly string[]
  showAllOption?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  function toggle(opt: string) {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt))
    } else {
      onChange([...values, opt])
    }
  }

  const isActive = values.length > 0

  return (
    <div className={styles['filter-select-wrap']} ref={wrapRef}>
      <button
        type="button"
        className={`paragraph-small ${styles['filter-select-button']} ${isActive ? styles['filter-select-button-active'] : ''}`}
        aria-haspopup="listbox"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles['filter-select-value']}>{label}</span>
        <span
          className={`${styles['filter-select-chevron']} ${open ? styles['filter-select-chevron-open'] : ''}`}
          aria-hidden="true"
        >
          <Image
            src="/images/chevron-down-muted.svg"
            alt=""
            width={10}
            height={6}
          />
        </span>
      </button>
      {open && (
        <ul
          className={styles['filter-select-menu']}
          role="listbox"
          aria-multiselectable
        >
          {showAllOption && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={values.length === 0}
                className={`paragraph-small ${styles['filter-select-option']}`}
                onClick={() => onChange([])}
              >
                <FilterCheckbox checked={values.length === 0} />
                All
              </button>
            </li>
          )}
          {options.map(opt => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={values.includes(opt)}
                className={`paragraph-small ${styles['filter-select-option']}`}
                onClick={() => toggle(opt)}
              >
                <FilterCheckbox checked={values.includes(opt)} />
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface AppliedFilter {
  label: string
  values: readonly string[]
  clear: () => void
}

function AppliedFilters({
  filters,
  clearAll,
}: {
  filters: AppliedFilter[]
  clearAll: () => void
}) {
  const active = filters.filter(f => f.values.length > 0)
  return (
    <div className={`${styles['applied-filters']} hide-mobile`}>
      <div className={styles['applied-filters-scroll']}>
        {active.map(f => (
          <button
            key={f.label}
            type="button"
            className={`paragraph-xs ${styles['applied-filter-chip']}`}
            onClick={f.clear}
          >
            <span>
              {f.label}: {f.values.join(', ')}
            </span>
            <span className={styles['applied-filter-x']} aria-hidden="true">
              <CloseIcon />
            </span>
          </button>
        ))}
      </div>
      {active.length > 0 && (
        <button
          type="button"
          className={`paragraph-xs ${styles['filter-clear']}`}
          onClick={clearAll}
        >
          Clear all filters
        </button>
      )}
    </div>
  )
}

interface SheetFilterGroup {
  label: string
  options: readonly string[]
  values: readonly string[]
  onChange: (next: string[]) => void
  showAllOption?: boolean
}

function MobileFilterPills({
  groups,
  clearAll,
}: {
  groups: SheetFilterGroup[]
  clearAll: () => void
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  const openGroup = groups.find(g => g.label === openLabel) ?? null
  const hasAnyActive = groups.some(g => g.values.length > 0)
  const orderedGroups = [
    ...groups.filter(g => g.values.length > 0),
    ...groups.filter(g => g.values.length === 0),
  ]

  function pillDisplay(g: SheetFilterGroup): string {
    if (g.values.length === 0) return g.label
    return `${g.label}: ${g.values.join(', ')}`
  }

  return (
    <>
      <div className={`${styles['mobile-pills-row']} desktop-hidden`}>
        {hasAnyActive && (
          <button
            type="button"
            className={styles['mobile-pill-x']}
            aria-label="Clear all filters"
            onClick={clearAll}
          >
            <CloseIcon />
          </button>
        )}
        {orderedGroups.map(g => {
          const isActive = g.values.length > 0
          return (
            <button
              key={g.label}
              type="button"
              className={`paragraph-small ${styles['mobile-pill']} ${isActive ? styles['mobile-pill-active'] : ''}`}
              onClick={() => setOpenLabel(g.label)}
            >
              <span className={styles['mobile-pill-label']}>
                {pillDisplay(g)}
              </span>
              <Image
                src="/images/chevron-down-muted.svg"
                alt=""
                width={10}
                height={6}
              />
            </button>
          )
        })}
      </div>
      {openGroup && (
        <SingleFilterSheet
          group={openGroup}
          onClose={() => setOpenLabel(null)}
        />
      )}
    </>
  )
}

function SingleFilterSheet({
  group,
  onClose,
}: {
  group: SheetFilterGroup
  onClose: () => void
}) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function toggle(opt: string) {
    if (group.values.includes(opt)) {
      group.onChange(group.values.filter(v => v !== opt))
    } else {
      group.onChange([...group.values, opt])
    }
  }

  return (
    <>
      <div
        className={styles['sheet-backdrop']}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={styles['sheet']}
        role="dialog"
        aria-modal="true"
        aria-label={group.label}
      >
        <header className={styles['sheet-header']}>
          <div />
          <h2 className={styles['sheet-title']}>{group.label}</h2>
          <button
            type="button"
            className={styles['sheet-close']}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <div className={styles['sheet-content']}>
          <section className={styles['sheet-section']}>
            {group.showAllOption && (
              <button
                type="button"
                role="checkbox"
                aria-checked={group.values.length === 0}
                className={styles['sheet-option']}
                onClick={() => group.onChange([])}
              >
                <span className={styles['sheet-option-label']}>All</span>
                <span
                  className={`${styles['sheet-checkbox']} ${group.values.length === 0 ? styles['sheet-checkbox-checked'] : ''}`}
                  aria-hidden="true"
                >
                  {group.values.length === 0 && (
                    <Image
                      src="/images/check-dark.svg"
                      alt=""
                      width={14}
                      height={14}
                    />
                  )}
                </span>
              </button>
            )}
            {group.options.map(opt => {
              const checked = group.values.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className={styles['sheet-option']}
                  onClick={() => toggle(opt)}
                >
                  <span className={styles['sheet-option-label']}>{opt}</span>
                  <span
                    className={`${styles['sheet-checkbox']} ${checked ? styles['sheet-checkbox-checked'] : ''}`}
                    aria-hidden="true"
                  >
                    {checked && (
                      <Image
                        src="/images/check-dark.svg"
                        alt=""
                        width={14}
                        height={14}
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </section>
        </div>
      </div>
    </>
  )
}

function CloseIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 2L8 8M2 8L8 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`${styles['filter-checkbox']} ${checked ? styles['filter-checkbox-checked'] : ''}`}
      aria-hidden="true"
    >
      {checked && (
        <Image src="/images/check-dark.svg" alt="" width={12} height={12} />
      )}
    </span>
  )
}

function EventCard({
  event,
  featured = false,
}: {
  event: EventListing
  featured?: boolean
}) {
  const dateLabel = eventDateLabel(event)
  const typeLabel = event.type.length > 0 ? event.type[0] : null
  const typeColorClass = typeLabel
    ? styles[`event-type-${typeLabel.toLowerCase()}`]
    : ''

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles['event-card']}
      onClick={() => trackListingClick('Events', event.name, event.url)}
    >
      {featured && (
        <>
          <Image
            src="/images/bookmark-light.svg"
            alt=""
            width={24}
            height={36}
            className={styles['event-card-bookmark']}
          />
          <div className={styles['event-card-image']}>
            {event.image && (
              <Image
                src={event.image}
                alt=""
                fill
                sizes="(max-width: 991px) 100vw, 500px"
                unoptimized
              />
            )}
          </div>
        </>
      )}
      <div className={styles['event-card-head']}>
        {!featured && (
          <div className={styles['event-card-logo']}>
            {event.logo && (
              <Image src={event.logo} alt="" fill sizes="48px" unoptimized />
            )}
          </div>
        )}
        <div className={styles['event-card-headtext']}>
          <h3 className={styles['event-card-title']}>{event.name}</h3>
          <div className={styles['event-card-meta']}>
            {event.location && (
              <span className="paragraph-xs color-teal-300">
                <Image
                  src="/images/location-pin-muted.svg"
                  alt=""
                  width={14}
                  height={14}
                />
                {event.location}
              </span>
            )}
            {dateLabel && (
              <span className="paragraph-xs color-teal-300">
                <Image
                  src="/images/calendar-muted.svg"
                  alt=""
                  width={14}
                  height={14}
                />
                {dateLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={styles['event-card-text']}>
        {typeLabel && (
          <p className={`paragraph-small-bold ${typeColorClass}`}>
            {featured ? `Featured ${typeLabel}` : typeLabel}
          </p>
        )}
        {event.description && (
          <p className={`paragraph-small ${styles['event-card-desc']}`}>
            {event.description}
          </p>
        )}
      </div>
    </a>
  )
}
