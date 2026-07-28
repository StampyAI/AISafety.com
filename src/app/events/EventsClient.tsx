'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react'
import { useSearchParams } from 'next/navigation'
import ListingCard from '@/components/ListingCard'
import FeaturedCard from '@/components/FeaturedCard'
import ContributeButtons from '@/components/ContributeButtons'
import FilterBar from '@/components/FilterBar'
import FilterDropdown from '@/components/FilterDropdown'
import ModeToggle from '@/components/ModeToggle'
import StickyBar, { scrollToAnchor } from '@/components/StickyBar'
import { EVENT_TYPES, eventTypeColor } from '@/lib/event-types'
import type { EventListing } from '@/lib/data/events'
import styles from './page.module.css'

const ADD_EVENT_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagns0zQqcM713eKk/form'
const SUGGEST_CORRECTION_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form'
const AIRTABLE_VIEW_URL =
  'https://airtable.com/appF8XfZUGXtfi40E/shrteEg2cClc3x484/tblXbN9swwldwq8f7?viewControls=on'

const applicationOptions = ['Open', 'Closed']
// Cards show the full Airtable Cost value ("Pay to attend (assistance
// available)", "Free (cash prize available)", …); the filter collapses
// them to two groups.
const costOptions = ['Pay to attend', 'Free']

function costGroup(cost: string): string {
  if (cost.startsWith('Pay to attend')) return 'Pay to attend'
  if (cost.startsWith('Free')) return 'Free'
  console.warn(`Unknown Cost value from Airtable: ${cost}`)
  return cost
}

type Mode = 'in-person' | 'online'

interface EventsClientProps {
  events: EventListing[]
}

function parseISO(date: string): Date {
  return new Date(date + 'T00:00:00Z')
}
function shortMonth(d: Date): string {
  // en-US, not en-GB: en-GB abbreviates September as "Sept".
  return new Intl.DateTimeFormat('en-US', {
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
  // Hybrid events can be attended either way, so the card spells out both
  // facets ("Online & Oxford, UK") the way /training listings do. The raw
  // location stays city-only in Airtable so the city filter isn't polluted.
  if (event.location)
    rows.push({
      icon: '/images/icons/pin.svg',
      value:
        event.mode === 'Hybrid' ? `Online & ${event.location}` : event.location,
    })
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
  if (deadline) rows.push({ icon: '/images/icons/paper.svg', value: deadline })
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
        placeholder="Type your city or country"
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

// The active set is shareable: the non-default tab writes ?view= to the
// address bar, the default keeps the bare URL. replaceState (not push) so
// toggling never stacks history entries; history.state is passed through
// untouched because Next.js keeps its routing internals there.
function syncViewParam(next: Mode) {
  const url = new URL(window.location.href)
  if (next === 'online') url.searchParams.delete('view')
  else url.searchParams.set('view', next)
  window.history.replaceState(window.history.state, '', url)
}

// Mirrors the URL back into state — reactively, not just on mount, because a
// soft navigation can rewrite the query string without remounting the page
// (e.g. clicking the nav's link for the page you're already on strips ?view=,
// and the old set would stay up while the bare URL promises the default).
// Lives in its own null-rendering leaf behind a Suspense boundary so
// useSearchParams doesn't bail the statically-generated page out to client
// rendering. Layout effect so a shared link swaps sets before first paint.
function ViewParamSync({ onView }: { onView: (view: string | null) => void }) {
  const view = useSearchParams().get('view')
  useLayoutEffect(() => {
    onView(view)
  }, [view, onView])
  return null
}

export default function EventsClient({ events }: EventsClientProps) {
  const [mode, setMode] = useState<Mode>('online')
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['Open'])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedCost, setSelectedCost] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState('')

  const toggleAnchorRef = useRef<HTMLDivElement>(null)

  // URL -> state, fed by ViewParamSync below. Unknown values fall through to
  // the default; a deep link doesn't auto-scroll the way a click does.
  // Landing on online drops the city filter, mirroring switchMode.
  const applyViewParam = useCallback((view: string | null) => {
    const next: Mode = view === 'in-person' ? 'in-person' : 'online'
    if (next === 'online') setSelectedCity('')
    setMode(next)
  }, [])

  // Switching sets replaces the whole grid, so jump back to the top of the
  // listings (just below the global nav) for the new set.
  function switchMode(next: Mode) {
    if (next === 'online') setSelectedCity('')
    setMode(next)
    syncViewParam(next)
    scrollToAnchor(toggleAnchorRef.current)
  }

  // Hybrid events belong to both views, so they stay visible whichever way
  // the toggle is set.
  const modeEvents = useMemo(
    () =>
      events.filter(e =>
        mode === 'online' ? e.mode !== 'In person' : e.mode !== 'Online'
      ),
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

  // Each dropdown's counts are faceted (like the 80,000 Hours job board):
  // an option's number is how many events would show if you picked it,
  // i.e. it respects every OTHER active filter (including the city) but not
  // the dropdown's own, so multi-selecting within one dropdown stays
  // possible. Mirrors TrainingClient.
  const { filteredEvents, statusCounts, typeCounts, costCounts } =
    useMemo(() => {
      const matchesFilters = (event: EventListing, skip?: string) => {
        if (
          skip !== 'status' &&
          selectedStatus.length > 0 &&
          !selectedStatus.includes(event.applicationStatus)
        )
          return false
        if (
          skip !== 'type' &&
          selectedTypes.length > 0 &&
          !event.type.some(t => selectedTypes.includes(t))
        )
          return false
        if (
          skip !== 'cost' &&
          selectedCost.length > 0 &&
          !event.cost.some(c => selectedCost.includes(costGroup(c)))
        )
          return false
        if (
          mode === 'in-person' &&
          selectedCity &&
          event.location !== selectedCity
        )
          return false
        return true
      }

      const countBy = (
        skip: string,
        extract: (e: EventListing) => string[]
      ) => {
        const counts: Record<string, number> = {}
        for (const e of modeEvents) {
          if (!matchesFilters(e, skip)) continue
          for (const key of extract(e)) counts[key] = (counts[key] || 0) + 1
        }
        return counts
      }

      return {
        filteredEvents: modeEvents.filter(e => matchesFilters(e)),
        statusCounts: countBy('status', e => [e.applicationStatus]),
        typeCounts: countBy('type', e => e.type),
        costCounts: countBy('cost', e => e.cost.map(costGroup)),
      }
    }, [
      modeEvents,
      selectedStatus,
      selectedTypes,
      selectedCost,
      mode,
      selectedCity,
    ])

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
      <Suspense fallback={null}>
        <ViewParamSync onView={applyViewParam} />
      </Suspense>
      {/* Sticky so it's always clear which of the two event sets is shown */}
      <div ref={toggleAnchorRef} aria-hidden="true" />
      <StickyBar className="margin-bottom-32px">
        <ModeToggle
          mode={mode}
          onChange={switchMode}
          ariaLabel="Event format"
          tabs={[
            {
              value: 'online',
              icon: '/images/icons/computer.svg',
              label: 'Online',
            },
            {
              value: 'in-person',
              icon: '/images/icons/pin.svg',
              label: 'In person',
            },
          ]}
        />
      </StickyBar>

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
          <div className={`border-only margin-bottom-32px ${styles.nearMe}`}>
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

        <ContributeButtons
          sidebar
          suggestEntryUrl={ADD_EVENT_URL}
          suggestCorrectionUrl={SUGGEST_CORRECTION_URL}
          noun="event"
          airtableUrl={AIRTABLE_VIEW_URL}
          airtableNote="(includes past events)"
        />
      </div>
    </>
  )
}
