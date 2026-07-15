'use client'

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import Image from 'next/image'
import ListingCard from '@/components/ListingCard'
import FeaturedCard from '@/components/FeaturedCard'
import ContributeButtons from '@/components/ContributeButtons'
import FilterBar from '@/components/FilterBar'
import FilterDropdown from '@/components/FilterDropdown'
import { EVENT_TYPES, eventTypeColor } from '@/lib/event-types'
import type { EventListing } from '@/lib/data/events'
import styles from './page.module.css'

const ADD_EVENT_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form'
const SUGGEST_CORRECTION_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form'
const AIRTABLE_VIEW_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/shrLgl03tMK4q6cyc/tblx0L8qJEaLBxJFS?viewControls=on'

const applicationOptions = ['Open', 'Closed']
const costOptions = ['Free', 'Paid', 'Paid (Stipend Available)']

type Mode = 'in-person' | 'online'

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

function formatDeadline(event: EventListing): string | null {
  if (!event.deadlineType || !event.applicationsClose) return null
  const d = parseISO(event.applicationsClose)
  return `${event.deadlineType} by ${d.getUTCDate()} ${shortMonth(d)} ${d.getUTCFullYear()}`
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
  const deadline = formatDeadline(event)
  const rows: { icon: string; value: string }[] = []
  if (event.host)
    rows.push({ icon: '/images/icons/person.svg', value: `By ${event.host}` })
  if (event.cost.length > 0)
    rows.push({ icon: '/images/icons/tag.svg', value: event.cost.join(', ') })
  if (deadline) rows.push({ icon: '/images/icons/timer.svg', value: deadline })
  return rows
}

function pluralizeTypes(types: string[]): string {
  const plural = types.map(t => `${t.toLowerCase()}s`)
  if (plural.length <= 1) return plural[0] ?? ''
  if (plural.length === 2) return `${plural[0]} and ${plural[1]}`
  return `${plural.slice(0, -1).join(', ')} and ${plural[plural.length - 1]}`
}

function emptyStateMessage(
  mode: Mode,
  selectedStatus: string[],
  selectedTypes: string[],
  selectedCost: string[]
): string {
  const activePills =
    (selectedStatus.length > 0 ? 1 : 0) +
    (selectedTypes.length > 0 ? 1 : 0) +
    (selectedCost.length > 0 ? 1 : 0)
  if (activePills > 1) {
    return 'No results found based on these filters. Try adjusting them.'
  }
  const modeLabel = mode === 'online' ? 'online' : 'in person'
  const cost =
    selectedCost.length > 0
      ? `${selectedCost.map(c => c.toLowerCase()).join(' or ')} `
      : ''
  const noun =
    selectedTypes.length > 0 ? pluralizeTypes(selectedTypes) : 'events'
  const applications =
    selectedStatus.length === 1
      ? ` with ${selectedStatus[0].toLowerCase()} applications`
      : ''
  return `No results found for ${cost}${noun} ${modeLabel}${applications}. Try adjusting the filters.`
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (m: Mode) => void
}) {
  const tab = (value: Mode, icon: string, label: string) => (
    <button
      type="button"
      className={`paragraph-small-bold ${styles.modeTab} ${mode === value ? styles.modeTabActive : ''}`}
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
    >
      <Image src={icon} alt="" width={16} height={16} unoptimized />
      {label}
    </button>
  )
  return (
    <div className={styles.modeToggle} role="group" aria-label="Event format">
      {tab('online', '/images/icons/computer.svg', 'Online')}
      {tab('in-person', '/images/icons/pin.svg', 'In person')}
    </div>
  )
}

function CitySearch({
  cities,
  selectedCity,
  onSelect,
  onClear,
}: {
  cities: string[]
  selectedCity: string
  onSelect: (city: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState(selectedCity)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const normalized = query.trim().toLowerCase()
  const matches = cities.filter(c => c.toLowerCase().includes(normalized))

  return (
    <div className={styles.nearMeSearch} ref={ref}>
      <span className={styles.nearMeIcon} aria-hidden="true" />
      <input
        type="text"
        className={`text-field ${styles.nearMeInput}`}
        placeholder="Type your city"
        maxLength={256}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          if (e.target.value.trim() === '') onClear()
        }}
      />
      {query.length > 0 && (
        <button
          type="button"
          className={styles.nearMeClear}
          aria-label="Clear city"
          onClick={() => {
            setQuery('')
            onClear()
            setOpen(false)
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6L14 14M14 6L6 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
      {open && (
        <div className={`${styles.cityList} drop-shadow-dark`}>
          {matches.length > 0 ? (
            matches.map(city => (
              <button
                key={city}
                type="button"
                className={`paragraph-small ${styles.cityOption}`}
                onClick={() => {
                  setQuery(city)
                  onSelect(city)
                  setOpen(false)
                }}
              >
                <span className={styles.cityOptionIcon} aria-hidden="true" />
                {city}
              </button>
            ))
          ) : (
            <p className={`paragraph-small ${styles.cityEmpty}`}>
              No events found in that city.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function EventsClient({ events }: EventsClientProps) {
  const [mode, setMode] = useState<Mode>('online')
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['Open'])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedCost, setSelectedCost] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState('')

  function switchMode(next: Mode) {
    if (next === 'online') setSelectedCity('')
    setMode(next)
  }

  const modeEvents = useMemo(
    () => events.filter(e => (mode === 'online' ? e.isOnline : !e.isOnline)),
    [events, mode]
  )

  const cities = useMemo(() => {
    const set = new Set<string>()
    for (const e of modeEvents) {
      const loc = e.location.trim()
      if (loc) set.add(loc)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [modeEvents])

  const featuredEvents = useMemo(
    () =>
      (['1', '2'] as const)
        .map(rank => modeEvents.find(e => e.featured === rank))
        .filter((e): e is EventListing => e != null),
    [modeEvents]
  )

  const filteredEvents = useMemo(() => {
    return modeEvents.filter(event => {
      if (
        selectedStatus.length > 0 &&
        !selectedStatus.includes(event.applicationStatus)
      )
        return false
      if (
        selectedTypes.length > 0 &&
        !event.type.some(t => selectedTypes.includes(t))
      )
        return false
      if (
        selectedCost.length > 0 &&
        !event.cost.some(c => selectedCost.includes(c))
      )
        return false
      if (
        mode === 'in-person' &&
        selectedCity &&
        event.location !== selectedCity
      )
        return false
      return true
    })
  }, [
    modeEvents,
    selectedStatus,
    selectedTypes,
    selectedCost,
    mode,
    selectedCity,
  ])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of modeEvents)
      counts[e.applicationStatus] = (counts[e.applicationStatus] || 0) + 1
    return counts
  }, [modeEvents])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of modeEvents)
      for (const t of e.type) counts[t] = (counts[t] || 0) + 1
    return counts
  }, [modeEvents])

  const costCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of modeEvents)
      for (const c of e.cost) counts[c] = (counts[c] || 0) + 1
    return counts
  }, [modeEvents])

  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; events: EventListing[] }[] = []
    for (const event of filteredEvents) {
      const key = monthKey(event.startDate)
      let group = groups.find(g => g.key === key)
      if (!group) {
        group = { key, label: monthLabel(event.startDate), events: [] }
        groups.push(group)
      }
      group.events.push(event)
    }
    return groups
  }, [filteredEvents])

  const savedScrollY = useRef<number | null>(null)
  const toggleFilter = (
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) => {
    savedScrollY.current = window.scrollY
    setter(
      current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
    )
  }
  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredEvents])

  return (
    <>
      <div className="padding-bottom-40px">
        <ModeToggle mode={mode} onChange={switchMode} />
      </div>

      {featuredEvents.length > 0 && (
        <div className="flex flex-wrap gap-56px padding-bottom-80px">
          {featuredEvents.map((event, i) => (
            <FeaturedCard
              key={event.id}
              className="width-6-col"
              href={event.url !== '#' ? event.url : undefined}
              tagline={
                event.type[0]
                  ? `Featured ${event.type[0].toLowerCase()}`
                  : 'Featured event'
              }
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

      <div className="width-9-col">
        <FilterBar
          count={filteredEvents.length}
          noun="event"
          className={styles.filterBar}
          label={`${filteredEvents.length} upcoming event${
            filteredEvents.length === 1 ? '' : 's'
          } ${mode === 'in-person' ? 'in person' : 'online'}`}
        >
          <FilterDropdown
            title="Applications"
            options={applicationOptions}
            selected={selectedStatus}
            counts={statusCounts}
            onToggle={v => toggleFilter(v, selectedStatus, setSelectedStatus)}
          />
          <FilterDropdown
            title="Event type"
            options={[...EVENT_TYPES]}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={v => toggleFilter(v, selectedTypes, setSelectedTypes)}
          />
          <FilterDropdown
            title="Cost"
            options={costOptions}
            selected={selectedCost}
            counts={costCounts}
            onToggle={v => toggleFilter(v, selectedCost, setSelectedCost)}
          />
        </FilterBar>

        {mode === 'in-person' && (
          <div className={`${styles.nearMe} margin-bottom-32px`}>
            <p className="paragraph-small padding-bottom-16px">
              Find events near you
            </p>
            <CitySearch
              cities={cities}
              selectedCity={selectedCity}
              onSelect={setSelectedCity}
              onClear={() => setSelectedCity('')}
            />
          </div>
        )}
      </div>

      <div className="flex gap-56px">
        <div className="width-9-col padding-bottom-80px">
          {monthGroups.map((group, i) => (
            <div
              key={group.key}
              className={i === 0 ? undefined : 'padding-top-32px'}
            >
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
          {filteredEvents.length === 0 && (
            <p className="paragraph-small color-teal-300">
              {emptyStateMessage(
                mode,
                selectedStatus,
                selectedTypes,
                selectedCost
              )}
            </p>
          )}
        </div>

        <div className={`hide-mobile width-3-col ${styles.sidebar}`}>
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
