'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useState, useMemo, useRef } from 'react'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'
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
  lastUpdated: string | null
  suggestEntryLink: string
  suggestCorrectionLink: string
}

export default function MapClient({
  orgs,
  lastUpdated,
  suggestEntryLink,
  suggestCorrectionLink,
}: MapClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const mapWrapperRef = useRef<HTMLDivElement>(null)

  const scrollToCards = () => {
    if (!mapWrapperRef.current) return
    const mapRect = mapWrapperRef.current.getBoundingClientRect()
    const scrollAmount = window.scrollY + mapRect.bottom
    window.scrollTo({ top: scrollAmount, behavior: 'smooth' })
  }

  const filteredOrgs = useMemo(() => {
    return orgs.filter(org => {
      if (org.isMagic) return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !org.title.toLowerCase().includes(query) &&
          !org.description.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (selectedCategories.length > 0) {
        const orgCategories = org.category
          .toLowerCase()
          .split(',')
          .map(c => c.trim())
        const hasMatchingCategory = selectedCategories.some(cat =>
          orgCategories.some(orgCat => orgCat.includes(cat.toLowerCase()))
        )
        if (!hasMatchingCategory) return false
      }

      if (showActive || showInactive) {
        const isActive = org.status === 'Active'
        if (isActive && !showActive) return false
        if (!isActive && !showInactive) return false
      }

      return true
    })
  }, [orgs, searchQuery, selectedCategories, showActive, showInactive])

  const mapOrgs = useMemo(() => {
    return orgs.filter(org => org.x !== null && org.y !== null)
  }, [orgs])

  const categoryCounts = useMemo(() => {
    return orgs.reduce(
      (counts, org) => {
        if (org.isMagic) return counts
        const orgCategories = org.category
          .toLowerCase()
          .split(',')
          .map(c => c.trim())
        for (const category of categories) {
          const catLower = category.toLowerCase()
          if (orgCategories.some(orgCat => orgCat.includes(catLower))) {
            counts[category] = (counts[category] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [orgs])

  const activeCount = useMemo(() => {
    return orgs.filter(org => !org.isMagic && org.status === 'Active').length
  }, [orgs])

  const inactiveCount = useMemo(() => {
    return orgs.filter(org => !org.isMagic && org.status !== 'Active').length
  }, [orgs])

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category))
    } else {
      setSelectedCategories([...selectedCategories, category])
    }
  }

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
            <Image src="/images/arrow-down.svg" alt="" width={16} height={16} />
          </button>
        </div>
      </div>

      <div id="cards" className="container-default">
        <p className="padding-bottom-24px paragraph-small color-teal-300">
          {lastUpdated ? `Last updated: ${lastUpdated}` : ''}
        </p>
        <h2 className="width-7-col padding-bottom-56px">
          An overview of the key{' '}
          <span className="color-light-teal">
            organizations, programs, and projects
          </span>{' '}
          operating in the AI safety space.
        </h2>

        <div className="database-outer-grid">
          <div>
            <div className="padding-bottom-40px">
              <input
                type="text"
                className="text-field"
                placeholder="Search listings by name or description"
                maxLength={256}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="collection-list padding-bottom-16px">
              {filteredOrgs.map(org => (
                <a
                  key={org.id}
                  href={org.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
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
                          loading="eager"
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
                <p className="paragraph-small color-teal-300">
                  No items found.
                </p>
              )}
            </div>
          </div>

          <div className="hide-mobile">
            <div className="flex flex-col gap-40px">
              <FilterGroup
                title="Category"
                options={categories}
                selected={selectedCategories}
                counts={categoryCounts}
                onToggle={toggleCategory}
              />
              <FilterGroup
                title="Status"
                options={['Active', 'No longer active']}
                selected={[
                  ...(showActive ? ['Active'] : []),
                  ...(showInactive ? ['No longer active'] : []),
                ]}
                counts={{
                  Active: activeCount,
                  'No longer active': inactiveCount,
                }}
                onToggle={status => {
                  if (status === 'Active') setShowActive(!showActive)
                  else setShowInactive(!showInactive)
                }}
              />
            </div>
            <ContributeButtons
              suggestEntryUrl={suggestEntryLink}
              suggestCorrectionUrl={suggestCorrectionLink}
              noun="listing"
              suggestEntryDescription="Suggest something to be listed on the map"
              extraLinks={[
                {
                  label: 'View raw data',
                  description: 'See the database in Airtable',
                  url: 'https://airtable.com/appF8XfZUGXtfi40E/shrLojIEOsNCKg1BL',
                },
              ]}
            />
          </div>
        </div>
      </div>
    </>
  )
}
