'use client'

import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react'
import FilterBar from '@/components/FilterBar'
import FilterDropdown from '@/components/FilterDropdown'
import ListingCard from '@/components/ListingCard'
import ContributeButtons from '@/components/ContributeButtons'
import { Community } from '@/lib/data/communities'
import { placementsById } from '@/lib/placements'

interface CommunitiesClientProps {
  communities: Community[]
}

// Filter options based on Airtable data
const typeOptions = ['Online', 'In person']
const activityOptions = ['Very active', 'Active', 'Semi-active', 'Inactive']
const focusOptions = ['Main focus is AI safety', 'Partial focus on AI safety']

export default function CommunitiesClient({
  communities,
}: CommunitiesClientProps) {
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const [activityFilters, setActivityFilters] = useState<string[]>([])
  const [focusFilters, setFocusFilters] = useState<string[]>([])

  // Each community's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(communities), [communities])

  const filteredCommunities = useMemo(() => {
    return communities.filter(community => {
      if (typeFilters.length > 0) {
        if (!community.type.some(t => typeFilters.includes(t))) return false
      }
      if (activityFilters.length > 0) {
        if (!activityFilters.includes(community.activityLevel)) return false
      }
      if (focusFilters.length > 0) {
        if (!focusFilters.includes(community.focus)) return false
      }
      return true
    })
  }, [communities, typeFilters, activityFilters, focusFilters])

  const filterCounts = useMemo(() => {
    const counts = {
      type: {} as Record<string, number>,
      activity: {} as Record<string, number>,
      focus: {} as Record<string, number>,
    }
    for (const community of communities) {
      for (const t of community.type) {
        counts.type[t] = (counts.type[t] || 0) + 1
      }
      if (community.activityLevel) {
        counts.activity[community.activityLevel] =
          (counts.activity[community.activityLevel] || 0) + 1
      }
      if (community.focus) {
        counts.focus[community.focus] = (counts.focus[community.focus] || 0) + 1
      }
    }
    return counts
  }, [communities])

  const savedScrollY = useRef<number | null>(null)

  // Card images are below the map and load lazily as they scroll into view.
  // After 7 s — by which time the map's tooltip logos should be done
  // preloading — proactively warm the browser cache for every card logo so
  // someone scrolling quickly down doesn't have to wait. The refs keep the
  // preloaded Image objects alive so their decoded bitmaps stay cached.
  const preloadedCardLogosRef = useRef<HTMLImageElement[]>([])
  useEffect(() => {
    const timer = setTimeout(() => {
      communities.forEach(c => {
        if (!c.logo) return
        const img = new window.Image()
        img.decoding = 'async'
        img.src = c.logo
        img.decode().catch(() => {})
        preloadedCardLogosRef.current.push(img)
      })
    }, 7000)
    return () => clearTimeout(timer)
  }, [communities])

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
  }, [filteredCommunities])

  const count = filteredCommunities.length

  return (
    <>
      <FilterBar
        count={count}
        noun="community"
        label={`${count} ${count === 1 ? 'community' : 'communities'}`}
      >
        <FilterDropdown
          trackingPage="Communities"
          title="Location"
          icon="/images/icons/pin.svg"
          options={typeOptions}
          selected={typeFilters}
          counts={filterCounts.type}
          onToggle={v => toggleFilter(v, typeFilters, setTypeFilters)}
        />
        <FilterDropdown
          trackingPage="Communities"
          title="Activity level"
          icon="/images/icons/activity.svg"
          options={activityOptions}
          selected={activityFilters}
          counts={filterCounts.activity}
          onToggle={v => toggleFilter(v, activityFilters, setActivityFilters)}
        />
        <FilterDropdown
          trackingPage="Communities"
          title="Focus"
          icon="/images/icons/target.svg"
          options={focusOptions}
          selected={focusFilters}
          counts={filterCounts.focus}
          onToggle={v => toggleFilter(v, focusFilters, setFocusFilters)}
        />
      </FilterBar>

      <div className="flex gap-56px">
        <div className="collection-list padding-bottom-40px width-9-col">
          {filteredCommunities.map(community => (
            <ListingCard
              key={community.id}
              href={community.joinLink !== '#' ? community.joinLink : undefined}
              name={community.name}
              description={community.description}
              logo={community.logo}
              meta={[
                {
                  icon: community.type.includes('In person')
                    ? '/images/icons/pin.svg'
                    : '/images/icons/computer.svg',
                  value: [
                    [...community.type]
                      .sort((a, b) =>
                        a === 'Online' ? -1 : b === 'Online' ? 1 : 0
                      )
                      .join(' & '),
                    // In-person (incl. hybrids): show the physical location only.
                    // Online-only: show the platform (the actual join info).
                    community.type.includes('In person')
                      ? community.location || ''
                      : community.platformText || community.platform.join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · '),
                },
                ...(community.activityLevel
                  ? [
                      {
                        icon: '/images/icons/activity.svg',
                        value: community.activityLevel,
                      },
                    ]
                  : []),
                ...(community.focus
                  ? [
                      {
                        icon: '/images/icons/target.svg',
                        value: community.focus,
                      },
                    ]
                  : []),
              ]}
              trackingPage="Communities"
              listingId={community.id}
              placement={placements.get(community.id)}
              trackingSource="cards"
            />
          ))}
          {filteredCommunities.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>

        <div className="hide-mobile width-3-col">
          {/* Related resources (moved here from the featured section, since the
              new full-width featured cards leave no room beside them) */}
          <div className="padding-bottom-40px">
            <p className="paragraph-small-bold padding-bottom-32px">
              Related resources
            </p>
            <a
              href="https://www.lesswrong.com/community"
              target="_blank"
              rel="noopener noreferrer"
              className="block padding-bottom-40px hover-opacity-80"
            >
              <h3 className="padding-bottom-16px">
                Map of LessWrong groups{' '}
                <span className="color-teal-400">→</span>
              </h3>
              <p className="paragraph-small color-teal-300">
                People in Rationalist groups like these often overlap with those
                in AI safety
              </p>
            </a>
            <a
              href="https://forum.effectivealtruism.org/groups"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover-opacity-80"
            >
              <h3 className="padding-bottom-16px">
                Map of EA groups <span className="color-teal-400">→</span>
              </h3>
              <p className="paragraph-small color-teal-300">
                Effective Altruism groups also tend to be concerned with AI
                safety
              </p>
            </a>
          </div>

          <ContributeButtons
            trackingPage="Communities"
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagKhplUqu07DwVqC/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="community"
            airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrA9iDx7G2roYKwq"
          />
        </div>
      </div>
    </>
  )
}
