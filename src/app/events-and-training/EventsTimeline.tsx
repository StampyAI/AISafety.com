'use client'

import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import Image from 'next/image'
import { Event } from '@/lib/data/events'
import { trackListingClick } from '@/lib/analytics'
import styles from './page.module.css'

interface EventsTimelineProps {
  events: Event[]
}

const TYPE_OPTIONS = [
  'Conference',
  'Fellowship',
  'Workshop',
  'Bootcamp',
  'Hackathon',
  'Meetup',
  'Talk',
  'Course',
  'Reading Group',
  'Competition',
  'Unconference',
  'Other',
]

const LOCATION_OPTIONS = [
  'Online',
  'USA',
  'UK',
  'Europe',
  'Canada',
  'Asia',
  'Australia/New Zealand',
  'Latin America',
  'Africa',
  'Middle East',
]

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatMonthLabel(key: string): { month: string; year: string } {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return {
    month: date.toLocaleDateString('en-US', { month: 'long' }),
    year: String(year),
  }
}

function formatDay(dateStr: string) {
  const date = parseLocalDate(dateStr)
  return {
    day: String(date.getDate()),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

function formatLength(days: number | null, start: string, end: string): string {
  if (days && days > 0) {
    return days === 1 ? '1 day' : `${days} days`
  }
  const startD = parseLocalDate(start)
  const endD = parseLocalDate(end)
  const diff =
    Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diff <= 0) return '1 day'
  return diff === 1 ? '1 day' : `${diff} days`
}

function buildKicker(event: Event, length: string): string {
  const parts: string[] = []
  if (event.types.length > 0) parts.push(event.types.join(' / '))
  if (event.locations.length > 0) parts.push(event.locations.join(' · '))
  parts.push(length)
  return parts.join('  ·  ')
}

function formatDeadline(event: Event): string | null {
  if (event.applicationsClose && event.registrationStatus === 'open') {
    const d = parseLocalDate(event.applicationsClose)
    return `Apply by ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  if (event.registrationStatus === 'closed') return 'Registration closed'
  return null
}

function hostInitial(host: string): string {
  return host.charAt(0).toUpperCase()
}

function ExternalArrow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 11.5L11.5 4.5M11.5 4.5H6M11.5 4.5V10" />
    </svg>
  )
}

export default function EventsTimeline({ events }: EventsTimelineProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set())
  const savedScrollY = useRef<number | null>(null)

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !event.name.toLowerCase().includes(q) &&
          !event.description.toLowerCase().includes(q) &&
          !event.host.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      if (selectedTypes.length > 0) {
        if (!event.types.some(t => selectedTypes.includes(t))) return false
      }
      if (selectedLocations.length > 0) {
        if (!event.locations.some(l => selectedLocations.includes(l)))
          return false
      }
      return true
    })
  }, [events, searchQuery, selectedTypes, selectedLocations])

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, Event[]>()
    for (const event of filteredEvents) {
      if (!event.startDate) continue
      const key = monthKey(event.startDate)
      const existing = groups.get(key) ?? []
      existing.push(event)
      groups.set(key, existing)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredEvents])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const event of events) {
      for (const type of event.types) {
        counts[type] = (counts[type] || 0) + 1
      }
    }
    return counts
  }, [events])

  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const event of events) {
      for (const loc of event.locations) {
        counts[loc] = (counts[loc] || 0) + 1
      }
    }
    return counts
  }, [events])

  const togglePill = (
    value: string,
    current: string[],
    setter: (next: string[]) => void
  ) => {
    savedScrollY.current = window.scrollY
    setter(
      current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
    )
  }

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredEvents])

  const clearAll = () => {
    setSearchQuery('')
    setSelectedTypes([])
    setSelectedLocations([])
  }
  const hasFilters =
    searchQuery !== '' ||
    selectedTypes.length > 0 ||
    selectedLocations.length > 0

  return (
    <>
      {/* SEARCH */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className="text-field"
          placeholder={`Search ${events.length} events`}
          maxLength={256}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        {/* FILTERS */}
        <nav className={styles.filterNav}>
          <div className={styles.filterLine}>
            <button
              type="button"
              className={`${styles.filterLink} ${selectedTypes.length === 0 ? styles.filterLinkActive : ''}`}
              onClick={() => {
                savedScrollY.current = window.scrollY
                setSelectedTypes([])
              }}
            >
              All types
            </button>
            {TYPE_OPTIONS.filter(t => typeCounts[t]).map(type => (
              <button
                key={type}
                type="button"
                className={`${styles.filterLink} ${selectedTypes.includes(type) ? styles.filterLinkActive : ''}`}
                onClick={() =>
                  togglePill(type, selectedTypes, setSelectedTypes)
                }
              >
                {type}
              </button>
            ))}
          </div>
          <div className={styles.filterLine}>
            <button
              type="button"
              className={`${styles.filterLink} ${selectedLocations.length === 0 ? styles.filterLinkActive : ''}`}
              onClick={() => {
                savedScrollY.current = window.scrollY
                setSelectedLocations([])
              }}
            >
              All locations
            </button>
            {LOCATION_OPTIONS.filter(l => locationCounts[l]).map(loc => (
              <button
                key={loc}
                type="button"
                className={`${styles.filterLink} ${selectedLocations.includes(loc) ? styles.filterLinkActive : ''}`}
                onClick={() =>
                  togglePill(loc, selectedLocations, setSelectedLocations)
                }
              >
                {loc}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* TIMELINE */}
      <div className={styles.timeline}>
        {groupedByMonth.length === 0 && (
          <p className="paragraph-small color-teal-300 padding-top-40px">
            No events match your filters.
          </p>
        )}
        {groupedByMonth.map(([key, monthEvents]) => {
          const { month, year } = formatMonthLabel(key)
          return (
            <section key={key} className={styles.monthSection}>
              <header className={styles.monthHeader}>
                <h2 className={styles.monthTitle}>{month}</h2>
                <span className={styles.monthYear}>{year}</span>
                <span className={styles.monthRule} aria-hidden="true" />
              </header>

              <ol className={styles.eventList}>
                {monthEvents.map(event => {
                  const { day, weekday } = formatDay(event.startDate!)
                  const length = formatLength(
                    event.lengthDays,
                    event.startDate!,
                    event.endDate!
                  )
                  const kicker = buildKicker(event, length)
                  const deadline = formatDeadline(event)
                  const isExpanded = expandedIds.has(event.id)
                  const showFavicon =
                    event.faviconUrl && !failedFavicons.has(event.id)

                  return (
                    <li key={event.id} className={styles.eventItem}>
                      <div className={styles.eventRow}>
                        <div className={styles.eventDate}>
                          <span className={styles.eventDay}>{day}</span>
                          <span className={styles.eventWeekday}>{weekday}</span>
                        </div>

                        <div className={styles.eventBody}>
                          <p className={styles.kicker}>{kicker}</p>

                          <h3 className={styles.eventTitle}>
                            {event.url ? (
                              <a
                                href={event.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.eventTitleLink}
                                onClick={() =>
                                  trackListingClick(
                                    'Events & training',
                                    event.name,
                                    event.url
                                  )
                                }
                              >
                                {event.name}
                                <ExternalArrow className={styles.eventArrow} />
                              </a>
                            ) : (
                              event.name
                            )}
                          </h3>

                          {event.host && (
                            <div className={styles.hostRow}>
                              {showFavicon ? (
                                <Image
                                  src={event.faviconUrl!}
                                  alt=""
                                  width={20}
                                  height={20}
                                  className={styles.hostFavicon}
                                  unoptimized
                                  onError={() =>
                                    setFailedFavicons(prev => {
                                      const next = new Set(prev)
                                      next.add(event.id)
                                      return next
                                    })
                                  }
                                />
                              ) : (
                                <span className={styles.hostMonogram}>
                                  {hostInitial(event.host)}
                                </span>
                              )}
                              <p className="paragraph-small color-teal-300">
                                {event.host}
                              </p>
                              {deadline && (
                                <>
                                  <span
                                    className={styles.hostSeparator}
                                    aria-hidden="true"
                                  >
                                    ·
                                  </span>
                                  <p
                                    className={`paragraph-small ${
                                      event.registrationStatus === 'closed'
                                        ? styles.closedText
                                        : 'color-teal-400'
                                    }`}
                                  >
                                    {deadline}
                                  </p>
                                </>
                              )}
                            </div>
                          )}

                          {event.description && (
                            <p
                              className={`paragraph-small ${styles.eventDescription} ${
                                isExpanded
                                  ? styles.eventDescriptionExpanded
                                  : ''
                              }`}
                              onClick={() => toggleExpanded(event.id)}
                            >
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </div>
    </>
  )
}
