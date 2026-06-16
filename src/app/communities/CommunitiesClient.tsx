'use client'

import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { Community } from '@/lib/data/communities'
import { trackListingClick } from '@/lib/analytics'

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

  const filteredCommunities = useMemo(() => {
    return communities.filter(community => {
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          community.name.toLowerCase().includes(query) ||
          community.description.toLowerCase().includes(query) ||
          (community.location &&
            community.location.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      // Type filter
      if (typeFilters.length > 0) {
        const hasMatchingType = community.type.some(t =>
          typeFilters.includes(t)
        )
        if (!hasMatchingType) return false
      }

      // Platform filter
      if (platformFilters.length > 0) {
        const hasMatchingPlatform = community.platform.some(p =>
          platformFilters.includes(p)
        )
        if (!hasMatchingPlatform) return false
      }

      // Activity level filter
      if (activityFilters.length > 0) {
        if (!activityFilters.includes(community.activityLevel)) return false
      }

      // Focus filter
      if (focusFilters.length > 0) {
        if (!focusFilters.includes(community.focus)) return false
      }

      return true
    })
  }, [
    communities,
    searchQuery,
    typeFilters,
    platformFilters,
    activityFilters,
    focusFilters,
  ])

  const filterCounts = useMemo(() => {
    const counts = {
      type: {} as Record<string, number>,
      platform: {} as Record<string, number>,
      activity: {} as Record<string, number>,
      focus: {} as Record<string, number>,
    }
    for (const community of communities) {
      for (const t of community.type) {
        counts.type[t] = (counts.type[t] || 0) + 1
      }
      for (const p of community.platform) {
        counts.platform[p] = (counts.platform[p] || 0) + 1
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
    <div className="database-outer-grid">
      <div>
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
                  href={community.joinLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                  onClick={() =>
                    trackListingClick(
                      'Communities',
                      community.name,
                      community.joinLink
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
      <aside className="hide-mobile">
        <FilterSidebar>
          <FilterGroup
            title="Type"
            options={typeOptions}
            selected={typeFilters}
            counts={filterCounts.type}
            onToggle={v => toggleFilter(v, typeFilters, setTypeFilters)}
          />
          <FilterGroup
            title="Platform"
            options={platformOptions}
            selected={platformFilters}
            counts={filterCounts.platform}
            onToggle={v => toggleFilter(v, platformFilters, setPlatformFilters)}
          />
          <FilterGroup
            title="Activity level"
            options={activityOptions}
            selected={activityFilters}
            counts={filterCounts.activity}
            onToggle={v => toggleFilter(v, activityFilters, setActivityFilters)}
          />
          <FilterGroup
            title="Focus"
            options={focusOptions}
            selected={focusFilters}
            counts={filterCounts.focus}
            onToggle={v => toggleFilter(v, focusFilters, setFocusFilters)}
          />
        </FilterSidebar>
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagKhplUqu07DwVqC/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="community"
        />
      </aside>
    </div>
  )
}
