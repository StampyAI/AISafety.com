'use client'

import dynamic from 'next/dynamic'
import Icon from '@/components/Icon'
import Image from 'next/image'
import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import RelativeDate from '@/components/RelativeDate'
import SearchBar from '@/components/SearchBar'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import { placementsById } from '@/lib/placements'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import styles from './page.module.css'

const D3Map = dynamic(() => import('./D3Map'), {
  ssr: false,
  loading: () => (
    <div
      className={styles['map-container']}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p className="paragraph-small color-teal-300">Loading map...</p>
    </div>
  ),
})

const categories = [
  'Advocacy',
  'Blog',
  'Capabilities research',
  'Career support',
  'Conceptual research',
  'Empirical research',
  'Forecasting',
  'Funding',
  'Governance',
  'Newsletter',
  'Podcast',
  'Research support',
  'Resource',
  'Strategy',
  'Training and education',
  'Video',
]

interface MapOrg {
  id: string
  title: string
  tooltipTitle: string
  shortName: string | null
  description: string
  category: string
  status: string
  logo: string | null
  mapLogo: string | null
  link: string
  x: number | null
  y: number | null
  scale: string | null
  isMagic: boolean
}

interface MapClientProps {
  orgs: MapOrg[]
  lastUpdatedIso: string | null
  suggestEntryLink: string
  suggestCorrectionLink: string
}

export default function MapClient({
  orgs,
  lastUpdatedIso,
  suggestEntryLink,
  suggestCorrectionLink,
}: MapClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const mapWrapperRef = useRef<HTMLDivElement>(null)

  // Each org's slot in the list below the map, stamped onto a list click so the
  // dashboard can tie clicks to position. (Clicks on the map itself are
  // geographic, not ranked, so they carry no slot.)
  const placements = useMemo(() => placementsById(orgs), [orgs])

  const scrollToCards = () => {
    if (!mapWrapperRef.current) return

    // Surface the shareable /map#cards link (issue #226). replaceState rather
    // than setting location.hash: the latter jump-scrolls instantly, fighting
    // the animation below, and would stack a history entry per click.
    const url = new URL(window.location.href)
    url.hash = 'cards'
    window.history.replaceState(window.history.state, '', url)

    const mapRect = mapWrapperRef.current.getBoundingClientRect()
    const scrollTarget = window.scrollY + mapRect.bottom

    // QA: Custom scroll animation matching the live site — the browser's
    // native smooth scroll starts too quickly and feels too slow overall.
    // Uses quadratic ease-out for a snappier feel with a 500ms duration.
    const startPos = window.scrollY
    const distance = scrollTarget - startPos
    const duration = 500
    const startTime = performance.now()

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      if (elapsed < duration) {
        const progress = elapsed / duration
        const easeOut = 1 - Math.pow(1 - progress, 2)
        window.scrollTo(0, startPos + distance * easeOut)
        requestAnimationFrame(step)
      } else {
        window.scrollTo(0, scrollTarget)
      }
    }

    requestAnimationFrame(step)
  }

  // Magic-map decorations are never listed; search applies on top.
  const basePass = useCallback(
    (org: MapOrg) => {
      if (org.isMagic) return false
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        org.title.toLowerCase().includes(query) ||
        org.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      category: {
        selected: selectedCategories,
        matches: (org: MapOrg, value: string) =>
          org.category
            .split(',')
            .map(c => c.trim())
            .includes(value),
      },
      status: {
        selected: [
          ...(showActive ? ['Active'] : []),
          ...(showInactive ? ['No longer active'] : []),
        ],
        matches: (org: MapOrg, value: string) =>
          value === 'Active'
            ? org.status === 'Active'
            : org.status !== 'Active',
      },
    }),
    [selectedCategories, showActive, showInactive]
  )

  const filteredOrgs = useMemo(
    () => filterItems(orgs, basePass, groups),
    [orgs, basePass, groups]
  )

  const mapOrgs = useMemo(() => {
    return orgs.filter(org => org.x !== null && org.y !== null)
  }, [orgs])

  const categoryCounts = useMemo(
    () =>
      optionCounts(
        filterItems(orgs, basePass, groups, 'category'),
        categories,
        groups.category.matches
      ),
    [orgs, basePass, groups]
  )

  const statusCounts = useMemo(
    () =>
      optionCounts(
        filterItems(orgs, basePass, groups, 'status'),
        ['Active', 'No longer active'],
        groups.status.matches
      ),
    [orgs, basePass, groups]
  )

  const savedScrollY = useRef<number | null>(null)

  const toggleCategory = (category: string) => {
    savedScrollY.current = window.scrollY
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category))
    } else {
      setSelectedCategories([...selectedCategories, category])
    }
  }

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredOrgs])

  return (
    <>
      <div className="padding-bottom-24px">
        <div ref={mapWrapperRef} className={styles['map-wrapper']}>
          <D3Map orgs={mapOrgs} />
          <button
            onClick={scrollToCards}
            className={`button-primary ${styles['scroll-button']}`}
          >
            View cards
            <Icon
              src="/images/icons/arrow-down.svg"
              className="color-teal-bright-400"
            />
          </button>
        </div>
      </div>

      <div id="cards" className="container-default">
        {lastUpdatedIso && (
          <RelativeDate
            iso={lastUpdatedIso}
            className="padding-bottom-24px paragraph-small color-teal-300"
          />
        )}
        <h2 className="width-7-col padding-bottom-56px">
          An overview of the key{' '}
          <span className="color-light-teal">
            organizations, programs, and other resources
          </span>{' '}
          in the AI safety space.
        </h2>

        <div className="flex gap-56px">
          <div className="width-9-col">
            <div className="padding-bottom-40px">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search listings by name or description"
              />
            </div>

            <div className="collection-list padding-bottom-16px">
              {filteredOrgs.map(org => (
                <a
                  key={org.id}
                  href={withUtm(org.link, 'Map')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                  onClick={() =>
                    trackListingClick(
                      'Map',
                      org.title,
                      org.link,
                      org.id,
                      placements.get(org.id),
                      'cards',
                      // First category = the org's map area; the dashboard
                      // groups Map-page activity by it.
                      org.category.split(',')[0].trim() || undefined
                    )
                  }
                >
                  <div className="flex items-center gap-16px padding-bottom-24px">
                    <div className="featured-img">
                      {org.logo && (
                        <Image
                          src={org.logo}
                          alt=""
                          className="card-image"
                          width={64}
                          height={64}
                          unoptimized
                          onError={e => {
                            ;(e.target as HTMLImageElement).style.display =
                              'none'
                          }}
                        />
                      )}
                    </div>
                    <h3>{org.title}</h3>
                  </div>
                  <p className="paragraph-small padding-bottom-24px">
                    {org.description}
                  </p>
                  <p className="paragraph-xs-bold color-teal-400 padding-bottom-4px">
                    Category
                  </p>
                  <p className="paragraph-small">{org.category}</p>
                </a>
              ))}
              {filteredOrgs.length === 0 && (
                <p className="paragraph-small color-teal-300">Nothing found.</p>
              )}
            </div>
          </div>

          <div className="hide-mobile width-3-col">
            <FilterSidebar>
              <FilterGroup
                trackingPage="Map"
                title="Category"
                options={categories}
                selected={selectedCategories}
                counts={categoryCounts}
                onToggle={toggleCategory}
              />
              <FilterGroup
                trackingPage="Map"
                title="Status"
                options={['Active', 'No longer active']}
                selected={[
                  ...(showActive ? ['Active'] : []),
                  ...(showInactive ? ['No longer active'] : []),
                ]}
                counts={statusCounts}
                onToggle={status => {
                  savedScrollY.current = window.scrollY
                  if (status === 'Active') setShowActive(!showActive)
                  else setShowInactive(!showInactive)
                }}
              />
            </FilterSidebar>
            <ContributeButtons
              trackingPage="Map"
              suggestEntryUrl={suggestEntryLink}
              suggestCorrectionUrl={suggestCorrectionLink}
              noun="listing"
              airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrLojIEOsNCKg1BL"
            />
          </div>
        </div>
      </div>
    </>
  )
}
