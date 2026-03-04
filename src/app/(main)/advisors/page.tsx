'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'

const focusOptions = ['Career/contribution', 'Other']

const statusOptions = ['Active', 'Inactive']

interface Advisor {
  id: string
  name: string
  description: string
  logo: string | null
  focus: string
  status: string
  url: string
  lastModified: string | null
}

export default function AdvisorsPage() {
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFocus, setSelectedFocus] = useState<Set<string>>(new Set())
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/advisors')
        if (!res.ok) throw new Error('Failed to fetch data')
        const data = await res.json()
        setAdvisors(data.records)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredAdvisors = advisors.filter(advisor => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !advisor.name.toLowerCase().includes(query) &&
        !advisor.description.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    if (selectedFocus.size > 0) {
      const hasMatch = Array.from(selectedFocus).some(f =>
        advisor.focus.toLowerCase().includes(f.toLowerCase())
      )
      if (!hasMatch) return false
    }

    if (selectedStatus.size > 0) {
      const hasMatch = Array.from(selectedStatus).some(s =>
        advisor.status.toLowerCase().includes(s.toLowerCase())
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

  const focusCounts = advisors.reduce(
    (counts, advisor) => {
      for (const option of focusOptions) {
        if (advisor.focus.toLowerCase().includes(option.toLowerCase())) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  const statusCounts = advisors.reduce(
    (counts, advisor) => {
      for (const option of statusOptions) {
        if (advisor.status.toLowerCase().includes(option.toLowerCase())) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Advisors</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/advisors"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        <span className="color-light-teal">
          Connecting with human experts can be invaluable.
        </span>{' '}
        These advisors offer free guidance calls to help you most effectively
        contribute to AI safety.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://80000hours.org/speak-with-us/?int_campaign=aisafety.com"
            tagline="Experienced EA career advisors"
            name="80,000 Hours"
            description="Career advice by a well-connected and professional organization dedicated to helping people use their career for good. Does not accept all applications."
            logo="/images/download-2-1.svg"
            metadata={[
              { label: 'Focus', value: 'Career/contribution' },
              { label: 'Status', value: 'Active' },
            ]}
          />
          <FeaturedCard
            href="https://aisafety.quest/#calls"
            tagline="Impact-focused career advice"
            name="AI Safety Quest"
            description="Grassroots volunteer organization helping people contribute to reducing catastrophic risk from AI by directing them to the most relevant resources and communities."
            logo="/images/download-2-1.svg"
            metadata={[
              { label: 'Focus', value: 'Career/contribution' },
              { label: 'Status', value: 'Active' },
            ]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://youtu.be/OpufM6yK4Go"
            target="_blank"
            rel="noopener noreferrer"
            className="block padding-bottom-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              Career advice video <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Video overview of career paths in AI safety
            </p>
          </a>
          <Link href="/events-and-training" className="block hover-opacity-80">
            <h3 className="padding-bottom-16px">
              Events &amp; training{' '}
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
        <div>
          <div className="padding-bottom-40px">
            <input
              type="text"
              className="text-field"
              placeholder="Search advisors by name or description"
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
              {filteredAdvisors.map(advisor => (
                <a
                  key={advisor.id}
                  href={advisor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                >
                  <div className="flex items-center gap-16px padding-bottom-24px">
                    <div className="featured-img">
                      {advisor.logo && (
                        <Image
                          src={advisor.logo}
                          alt=""
                          className="card-image"
                          width={64}
                          height={64}
                          unoptimized
                        />
                      )}
                    </div>
                    <h3>{advisor.name}</h3>
                  </div>
                  <p className="paragraph-small padding-bottom-24px">
                    {advisor.description}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Focus
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {advisor.focus}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Status
                  </p>
                  <p className="paragraph-small">{advisor.status}</p>
                </a>
              ))}
              {filteredAdvisors.length === 0 && (
                <p className="paragraph-small color-teal-300">
                  No items found.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="hide-mobile">
          <FilterGroup
            title="Focus"
            options={focusOptions}
            selected={Array.from(selectedFocus)}
            counts={focusCounts}
            onToggle={v => toggle(v, selectedFocus, setSelectedFocus)}
          />
          <FilterGroup
            title="Status"
            options={statusOptions}
            selected={Array.from(selectedStatus)}
            counts={statusCounts}
            onToggle={v => toggle(v, selectedStatus, setSelectedStatus)}
          />
          <ContributeButtons
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="advisor"
          />
        </div>
      </div>
    </div>
  )
}
