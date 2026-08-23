'use client'

import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { Funder } from '@/lib/data/funding'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import { placementsById } from '@/lib/placements'

interface FundingClientProps {
  funders: Funder[]
}

const acceptingOptions = ['Yes', 'No']

const typeOptions = ['Fund', 'Grant program', 'Platform']

export default function FundingClient({ funders }: FundingClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccepting, setSelectedAccepting] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  // Each funder's slot in the full (unfiltered) page order, so a click is
  // tagged with the rank Bryce set — not its position within an active filter.
  const placements = useMemo(() => placementsById(funders), [funders])

  const searchPass = useCallback(
    (funder: Funder) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        funder.name.toLowerCase().includes(query) ||
        funder.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      accepting: {
        selected: selectedAccepting,
        // Airtable values are prefixed: "Yes – rolling basis", "Yes –
        // closes …", or "No". Match on the prefix so the Yes/No filter
        // catches all variants.
        matches: (funder: Funder, value: string) =>
          (funder.acceptingApplications || '').startsWith(value),
      },
      type: {
        selected: selectedTypes,
        matches: (funder: Funder, value: string) =>
          (funder.type || '')
            .split(',')
            .map(t => t.trim())
            .includes(value),
      },
    }),
    [selectedAccepting, selectedTypes]
  )

  const filteredFunders = useMemo(
    () => filterItems(funders, searchPass, groups),
    [funders, searchPass, groups]
  )

  const acceptingCounts = useMemo(
    () =>
      optionCounts(
        filterItems(funders, searchPass, groups, 'accepting'),
        acceptingOptions,
        groups.accepting.matches
      ),
    [funders, searchPass, groups]
  )

  const typeCounts = useMemo(
    () =>
      optionCounts(
        filterItems(funders, searchPass, groups, 'type'),
        typeOptions,
        groups.type.matches
      ),
    [funders, searchPass, groups]
  )

  const savedScrollY = useRef<number | null>(null)

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
  }, [filteredFunders])

  return (
    <div className="flex gap-56px">
      <div className="width-9-col">
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search funders by name or description"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredFunders.map(funder => (
            <a
              key={funder.id}
              href={withUtm(funder.url, 'Funding')}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              onClick={() =>
                trackListingClick(
                  'Funding',
                  funder.name,
                  funder.url,
                  funder.id,
                  placements.get(funder.id)
                )
              }
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
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile width-3-col">
        <FilterSidebar>
          <FilterGroup
            trackingPage="Funding"
            title="Accepting applications"
            options={acceptingOptions}
            selected={selectedAccepting}
            counts={acceptingCounts}
            onToggle={v =>
              toggleFilter(v, selectedAccepting, setSelectedAccepting)
            }
          />
          <FilterGroup
            trackingPage="Funding"
            title="Type"
            options={typeOptions}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={v => toggleFilter(v, selectedTypes, setSelectedTypes)}
          />
        </FilterSidebar>
        <ContributeButtons
          trackingPage="Funding"
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="funder"
          airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shr9Mki0gKgHFdcbd"
        />
      </div>
    </div>
  )
}
