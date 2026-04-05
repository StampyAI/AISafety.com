'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'
import { Funder } from '@/lib/data/funding'

interface FundingClientProps {
  funders: Funder[]
}

const acceptingOptions = ['Yes', 'No']

const typeOptions = [
  'Fund',
  'Grant program',
  'Grant-based fellowship',
  'Incubator',
  'Platform',
  'Venture capitalist',
]

export default function FundingClient({ funders }: FundingClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccepting, setSelectedAccepting] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const filteredFunders = useMemo(() => {
    return funders.filter(funder => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !funder.name.toLowerCase().includes(query) &&
          !funder.description.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (selectedAccepting.length > 0) {
        const hasMatch = selectedAccepting.some(
          a =>
            (funder.acceptingApplications || '').toLowerCase() ===
            a.toLowerCase()
        )
        if (!hasMatch) return false
      }

      if (selectedTypes.length > 0) {
        const funderTypes = (funder.type || '')
          .toLowerCase()
          .split(',')
          .map(t => t.trim())
        const hasMatch = selectedTypes.some(t =>
          funderTypes.some(ft => ft.includes(t.toLowerCase()))
        )
        if (!hasMatch) return false
      }

      return true
    })
  }, [funders, searchQuery, selectedAccepting, selectedTypes])

  const acceptingCounts = useMemo(() => {
    return funders.reduce(
      (counts, funder) => {
        for (const option of acceptingOptions) {
          if (
            (funder.acceptingApplications || '').toLowerCase() ===
            option.toLowerCase()
          ) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [funders])

  const typeCounts = useMemo(() => {
    return funders.reduce(
      (counts, funder) => {
        const types = (funder.type || '')
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
  }, [funders])

  const toggleFilter = (
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value))
    } else {
      setter([...current, value])
    }
  }

  return (
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
                      loading="eager"
                      onError={e => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
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
              <p className="paragraph-small">{funder.acceptingApplications}</p>
            </a>
          ))}
          {filteredFunders.length === 0 && (
            <p className="paragraph-small color-teal-300">No items found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <div className="flex flex-col gap-40px">
          <FilterGroup
            title="Accepting applications"
            options={acceptingOptions}
            selected={selectedAccepting}
            counts={acceptingCounts}
            onToggle={v =>
              toggleFilter(v, selectedAccepting, setSelectedAccepting)
            }
          />
          <FilterGroup
            title="Type"
            options={typeOptions}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={v => toggleFilter(v, selectedTypes, setSelectedTypes)}
          />
        </div>
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="funder"
          suggestCorrectionDescription="Let us know of any changes that should be made"
        />
      </div>
    </div>
  )
}
