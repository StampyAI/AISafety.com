'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'

const recipientOptions = [
  'Researchers',
  'Individuals',
  'Early-stage startups',
  'Existing companies',
  'Academics',
  'Entrepreneurs',
  'Non-profits',
  'Youth',
]

const acceptingOptions = ['Yes', 'No']

const typeOptions = [
  'Fund',
  'Grant program',
  'Grant-based fellowship',
  'Incubator',
  'Platform',
  'Venture capitalist',
]

interface Funder {
  id: string
  name: string
  description: string
  logo: string | null
  type: string
  recipientType: string
  acceptingApplications: string
  url: string
  lastModified: string | null
}

export default function FundingPage() {
  const [funders, setFunders] = useState<Funder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(
    new Set()
  )
  const [selectedAccepting, setSelectedAccepting] = useState<Set<string>>(
    new Set()
  )
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/funding')
        if (!res.ok) throw new Error('Failed to fetch data')
        const data = await res.json()
        setFunders(data.records)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredFunders = funders.filter(funder => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !funder.name.toLowerCase().includes(query) &&
        !funder.description.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    if (selectedRecipients.size > 0) {
      const funderRecipients = funder.recipientType
        .toLowerCase()
        .split(',')
        .map(r => r.trim())
      const hasMatch = Array.from(selectedRecipients).some(r =>
        funderRecipients.some(fr => fr.includes(r.toLowerCase()))
      )
      if (!hasMatch) return false
    }

    if (selectedAccepting.size > 0) {
      const hasMatch = Array.from(selectedAccepting).some(
        a => funder.acceptingApplications.toLowerCase() === a.toLowerCase()
      )
      if (!hasMatch) return false
    }

    if (selectedTypes.size > 0) {
      const funderTypes = funder.type
        .toLowerCase()
        .split(',')
        .map(t => t.trim())
      const hasMatch = Array.from(selectedTypes).some(t =>
        funderTypes.some(ft => ft.includes(t.toLowerCase()))
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

  const recipientCounts = funders.reduce(
    (counts, funder) => {
      const types = funder.recipientType
        .toLowerCase()
        .split(',')
        .map(r => r.trim())
      for (const option of recipientOptions) {
        if (types.some(t => t.includes(option.toLowerCase()))) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  const acceptingCounts = funders.reduce(
    (counts, funder) => {
      for (const option of acceptingOptions) {
        if (
          funder.acceptingApplications.toLowerCase() === option.toLowerCase()
        ) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  const typeCounts = funders.reduce(
    (counts, funder) => {
      const types = funder.type
        .toLowerCase()
        .split(',')
        .map(t => t.trim())
      for (const option of typeOptions) {
        if (types.some(t => t.includes(option.toLowerCase()))) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Funding</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/funding"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        These organizations offer{' '}
        <span className="color-light-teal">financial support</span> to
        organizations and individuals working on AI safety.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://coefficientgiving.org/apply-for-funding/"
            tagline="Largest funder in x-risk reduction"
            name="Coefficient Giving"
            description="Most funding is done via proactive research, but there are frequent requests for proposals in certain areas. Previously called Open Philanthropy."
            logo="/images/download-2-1.svg"
            metadata={[
              { label: 'Type', value: 'Fund' },
              { label: 'Accepting applications', value: 'Yes' },
            ]}
          />
          <FeaturedCard
            href="https://survivalandflourishing.fund/"
            tagline="Best for mid- to large-scale projects"
            name="Survival and Flourishing Fund"
            description="Provides financial support to organizations working to improve humanity's long-term prospects for survival and flourishing."
            logo="/images/download-2-1.svg"
            metadata={[
              { label: 'Type', value: 'Fund' },
              { label: 'Accepting applications', value: 'Yes' },
            ]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://www.lesswrong.com/posts/WGpFFJo2uFe5ssgEb/an-overview-of-the-ai-safety-funding-situation"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              An overview of the funding situation{' '}
              <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              An analysis of the main funding sources in AI safety over time,
              last updated early 2025
            </p>
          </a>
        </aside>
      </div>

      {/* Database Grid */}
      <div className="database-outer-grid">
        <div>
          <div className="padding-bottom-40px">
            <input
              type="text"
              className="text-field"
              placeholder="Search funders by name or description"
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
              {filteredFunders.map(funder => (
                <a
                  key={funder.id}
                  href={funder.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                >
                  <div className="flex items-center gap-16px padding-bottom-24px">
                    <div className="featured-img">
                      {funder.logo && (
                        <Image
                          src={funder.logo}
                          alt=""
                          className="card-image"
                          width={64}
                          height={64}
                          unoptimized
                        />
                      )}
                    </div>
                    <h3>{funder.name}</h3>
                  </div>
                  <p className="paragraph-small padding-bottom-24px">
                    {funder.description}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Type
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {funder.type}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Accepting applications
                  </p>
                  <p className="paragraph-small">
                    {funder.acceptingApplications}
                  </p>
                </a>
              ))}
              {filteredFunders.length === 0 && (
                <p className="paragraph-small color-teal-300">
                  No items found.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="hide-mobile">
          <FilterGroup
            title="Recipient type"
            options={recipientOptions}
            selected={Array.from(selectedRecipients)}
            counts={recipientCounts}
            onToggle={v => toggle(v, selectedRecipients, setSelectedRecipients)}
          />
          <FilterGroup
            title="Accepting applications"
            options={acceptingOptions}
            selected={Array.from(selectedAccepting)}
            counts={acceptingCounts}
            onToggle={v => toggle(v, selectedAccepting, setSelectedAccepting)}
          />
          <FilterGroup
            title="Type"
            options={typeOptions}
            selected={Array.from(selectedTypes)}
            counts={typeCounts}
            onToggle={v => toggle(v, selectedTypes, setSelectedTypes)}
          />
          <ContributeButtons
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="funder"
          />
        </div>
      </div>
    </div>
  )
}
