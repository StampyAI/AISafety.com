'use client'

import {
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { Community } from '@/lib/data/communities'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import { placementsById } from '@/lib/placements'

interface CommunitiesClientProps {
  communities: Community[]
}

// Filter options based on Airtable data
const typeOptions = ['Online', 'In person']
const platformOptions = [
  'Discord',
  'Facebook',
  'Forum',
  'Gather',
  'Reddit',
  'Slack',
  'Telegram',
  'WhatsApp',
  'Other',
]
const activityOptions = ['Very active', 'Active', 'Semi-active', 'Inactive']
const focusOptions = ['Main focus is AI safety', 'Partial focus on AI safety']

export default function CommunitiesClient({
  communities,
}: CommunitiesClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const [platformFilters, setPlatformFilters] = useState<string[]>([])
  const [activityFilters, setActivityFilters] = useState<string[]>([])
  const [focusFilters, setFocusFilters] = useState<string[]>([])

  // Each community's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(communities), [communities])

  const searchPass = useCallback(
    (community: Community) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        community.name.toLowerCase().includes(query) ||
        community.description.toLowerCase().includes(query) ||
        Boolean(
          community.location && community.location.toLowerCase().includes(query)
        )
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      type: {
        selected: typeFilters,
        matches: (community: Community, value: string) =>
          community.type.includes(value),
      },
      platform: {
        selected: platformFilters,
        matches: (community: Community, value: string) =>
          community.platform.includes(value),
      },
      activity: {
        selected: activityFilters,
        matches: (community: Community, value: string) =>
          community.activityLevel === value,
      },
      focus: {
        selected: focusFilters,
        matches: (community: Community, value: string) =>
          community.focus === value,
      },
    }),
    [typeFilters, platformFilters, activityFilters, focusFilters]
  )

  const filteredCommunities = useMemo(
    () => filterItems(communities, searchPass, groups),
    [communities, searchPass, groups]
  )

  const filterCounts = useMemo(
    () => ({
      type: optionCounts(
        filterItems(communities, searchPass, groups, 'type'),
        typeOptions,
        groups.type.matches
      ),
      platform: optionCounts(
        filterItems(communities, searchPass, groups, 'platform'),
        platformOptions,
        groups.platform.matches
      ),
      activity: optionCounts(
        filterItems(communities, searchPass, groups, 'activity'),
        activityOptions,
        groups.activity.matches
      ),
      focus: optionCounts(
        filterItems(communities, searchPass, groups, 'focus'),
        focusOptions,
        groups.focus.matches
      ),
    }),
    [communities, searchPass, groups]
  )

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
  }, [filteredCommunities])

  return (
    <div className="flex gap-56px">
      <div className="width-9-col">
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search communities by title, description, or location"
          />
        </div>

        {/* Community Cards */}
        <div className="collection-list">
          {filteredCommunities.length === 0 ? (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          ) : (
            filteredCommunities.map(community => {
              const hasLink =
                Boolean(community.joinLink) && community.joinLink !== '#'
              const cardContent = (
                <>
                  <div className="flex items-center gap-16px padding-bottom-24px">
                    {community.logo && (
                      <div className="featured-img">
                        <Image
                          src={community.logo}
                          alt={`${community.name} logo`}
                          width={64}
                          height={64}
                          className="card-image"
                          unoptimized
                          onError={e => {
                            ;(e.target as HTMLImageElement).style.display =
                              'none'
                          }}
                        />
                      </div>
                    )}
                    <h3>{community.name}</h3>
                  </div>
                  {community.description && (
                    <p className="paragraph-small padding-bottom-24px">
                      {community.description}
                    </p>
                  )}
                  <p className="paragraph-xs-bold color-teal-400 padding-bottom-4px">
                    Platform
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {community.platformText || community.platform.join(', ')}
                  </p>
                  <p className="paragraph-xs-bold color-teal-400 padding-bottom-4px">
                    Activity level
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {community.activityLevel}
                  </p>
                  <p className="paragraph-xs-bold color-teal-400 padding-bottom-4px">
                    Focus
                  </p>
                  <p className="paragraph-small">{community.focus}</p>
                </>
              )

              if (!hasLink) {
                return (
                  <div key={community.id} className="card card-static">
                    {cardContent}
                  </div>
                )
              }

              return (
                <Link
                  key={community.id}
                  href={withUtm(community.joinLink, 'Communities')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                  onClick={() =>
                    trackListingClick(
                      'Communities',
                      community.name,
                      community.joinLink,
                      community.id,
                      placements.get(community.id),
                      'cards'
                    )
                  }
                >
                  {cardContent}
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* Filters Sidebar */}
      <aside className="hide-mobile width-3-col">
        <FilterSidebar>
          <FilterGroup
            trackingPage="Communities"
            title="Type"
            options={typeOptions}
            selected={typeFilters}
            counts={filterCounts.type}
            onToggle={v => toggleFilter(v, typeFilters, setTypeFilters)}
          />
          <FilterGroup
            trackingPage="Communities"
            title="Platform"
            options={platformOptions}
            selected={platformFilters}
            counts={filterCounts.platform}
            onToggle={v => toggleFilter(v, platformFilters, setPlatformFilters)}
          />
          <FilterGroup
            trackingPage="Communities"
            title="Activity level"
            options={activityOptions}
            selected={activityFilters}
            counts={filterCounts.activity}
            onToggle={v => toggleFilter(v, activityFilters, setActivityFilters)}
          />
          <FilterGroup
            trackingPage="Communities"
            title="Focus"
            options={focusOptions}
            selected={focusFilters}
            counts={filterCounts.focus}
            onToggle={v => toggleFilter(v, focusFilters, setFocusFilters)}
          />
        </FilterSidebar>
        <ContributeButtons
          trackingPage="Communities"
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagKhplUqu07DwVqC/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="community"
          airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrA9iDx7G2roYKwq"
        />
      </aside>
    </div>
  )
}
