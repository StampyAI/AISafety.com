'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'

const typeOptions = [
  'Article/tool',
  'Fiscal sponsor',
  'Incubator',
  'Venture capitalist',
]

interface FounderResource {
  id: string
  name: string
  sort: number | null
  type: string
  image: string | null
  description: string
  website: string
}

export default function FoundersPage() {
  const [resources, setResources] = useState<FounderResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/founders')
        if (!res.ok) throw new Error('Failed to fetch data')
        const data = await res.json()
        setResources(data.records)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredResources = resources.filter(resource => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !resource.name.toLowerCase().includes(query) &&
        !resource.description.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    if (selectedTypes.size > 0) {
      const resourceType = resource.type.toLowerCase().trim()
      const hasMatch = Array.from(selectedTypes).some(t =>
        resourceType.includes(t.toLowerCase())
      )
      if (!hasMatch) return false
    }

    return true
  })

  const toggle = (
    value: string,
    selected: Set<string>,
    setter: (s: Set<string>) => void
  ) => {
    const next = new Set(selected)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    setter(next)
  }

  const typeCounts = resources.reduce(
    (counts, resource) => {
      const resourceType = resource.type.toLowerCase().trim()
      for (const option of typeOptions) {
        if (resourceType.includes(option.toLowerCase())) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  return (
    <div className="container-default">
      {/* Hero */}
      <h1 className="padding-top-56px padding-bottom-8px">Founder Toolkit</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/founders"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        Resources for{' '}
        <span className="color-light-teal">starting and growing</span> an AI
        safety organization – including incubators, fiscal sponsors, venture
        capital, and practical guides.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://beacongcr.org/"
            tagline="Featured fiscal sponsor"
            name="Beacon"
            description="Fiscal sponsorship, administrative support, and bureaucracy shielding for researchers safeguarding humanity from catastrophic risk."
            logo="/images/beacon-logo.webp"
            metadata={[{ label: 'Type', value: 'Fiscal sponsor' }]}
          />
          <FeaturedCard
            href="https://www.catalyze-impact.org/"
            tagline="Featured incubator"
            name="Catalyze Impact"
            description="Incubating early-stage AI safety research organizations. The program involves co-founder matching, mentorship, and seed funding, culminating in an in-person building phase."
            logo="/images/catalyze-impact-logo.png"
            metadata={[{ label: 'Type', value: 'Incubator' }]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <Link
            href="/funding"
            className="block padding-bottom-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              Funding <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Organizations offering financial support to AI safety projects and
              individuals
            </p>
          </Link>
          <Link href="/events-and-training" className="block hover-opacity-80">
            <h3 className="padding-bottom-16px">
              Events &amp; Training{' '}
              <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Upcoming fellowships, conferences, facilitated courses etc.
            </p>
          </Link>
        </aside>
      </div>

      {/* Database Grid */}
      <div className="database-outer-grid">
        {/* Left column: search + cards */}
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

          {loading ? (
            <div className="padding-bottom-40px">
              <p className="paragraph-small color-teal-300">Loading...</p>
            </div>
          ) : error ? (
            <div className="padding-bottom-40px">
              <p className="paragraph-small color-teal-300">Error: {error}</p>
            </div>
          ) : (
            <div className="collection-list padding-bottom-40px">
              {filteredResources.map(resource => (
                <a
                  key={resource.id}
                  href={resource.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                >
                  <div className="flex items-center gap-16px padding-bottom-24px">
                    <div className="featured-img">
                      {resource.image && (
                        <Image
                          src={resource.image}
                          alt=""
                          className="card-image"
                          width={64}
                          height={64}
                          unoptimized
                        />
                      )}
                    </div>
                    <h3>{resource.name}</h3>
                  </div>
                  <p className="paragraph-small padding-bottom-24px">
                    {resource.description}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Type
                  </p>
                  <p className="paragraph-small">{resource.type}</p>
                </a>
              ))}
              {filteredResources.length === 0 && (
                <p className="paragraph-small color-teal-300">
                  No items found.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column: filters (desktop only) */}
        <div className="hide-mobile">
          <FilterGroup
            title="Type"
            options={typeOptions}
            selected={Array.from(selectedTypes)}
            counts={typeCounts}
            onToggle={v => toggle(v, selectedTypes, setSelectedTypes)}
          />
          <ContributeButtons
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pag1OO5TrQkO96W7R/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="resource"
          />
        </div>
      </div>
    </div>
  )
}
