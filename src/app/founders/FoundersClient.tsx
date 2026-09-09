'use client'

import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { FounderResource } from '@/lib/data/founders'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { placementsById } from '@/lib/placements'
import FounderResourceCard from './FounderResourceCard'

interface FoundersClientProps {
  resources: FounderResource[]
}

const typeOptions = [
  'Article/tool',
  'Fiscal sponsor',
  'Incubator',
  'Venture capitalist',
]

export default function FoundersClient({ resources }: FoundersClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  // Each resource's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(resources), [resources])

  const searchPass = useCallback(
    (resource: FounderResource) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        resource.name.toLowerCase().includes(query) ||
        resource.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      type: {
        selected: selectedTypes,
        matches: (resource: FounderResource, value: string) =>
          resource.type
            .split(',')
            .map(t => t.trim())
            .includes(value),
      },
    }),
    [selectedTypes]
  )

  const filteredResources = useMemo(
    () => filterItems(resources, searchPass, groups),
    [resources, searchPass, groups]
  )

  const typeCounts = useMemo(
    () =>
      optionCounts(
        filterItems(resources, searchPass, groups, 'type'),
        typeOptions,
        groups.type.matches
      ),
    [resources, searchPass, groups]
  )

  const savedScrollY = useRef<number | null>(null)

  const toggleType = (type: string) => {
    savedScrollY.current = window.scrollY
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type))
    } else {
      setSelectedTypes([...selectedTypes, type])
    }
  }

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredResources])

  return (
    <div className="flex gap-56px">
      <div className="width-9-col">
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search listings by name or description"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredResources.map(resource => (
            <FounderResourceCard
              key={resource.id}
              resource={resource}
              placement={placements.get(resource.id)}
            />
          ))}
          {filteredResources.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile width-3-col">
        <FilterSidebar>
          <FilterGroup
            trackingPage="Founders"
            title="Type"
            options={typeOptions}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={toggleType}
          />
        </FilterSidebar>
        <ContributeButtons
          trackingPage="Founders"
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pag1OO5TrQkO96W7R/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="resource"
          airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shr63cQohkMqyzOZv"
        />
      </div>
    </div>
  )
}
