'use client'

import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { Advisor } from '@/lib/data/advisors'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { placementsById } from '@/lib/placements'
import AdvisorCard from './AdvisorCard'

interface AdvisorsClientProps {
  advisors: Advisor[]
}

const focusOptions = ['Career/contribution', 'Other']
const statusOptions = ['Active', 'Inactive']

export default function AdvisorsClient({ advisors }: AdvisorsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFocus, setSelectedFocus] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['Active'])

  // Each advisor's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(advisors), [advisors])

  const searchPass = useCallback(
    (advisor: Advisor) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        advisor.name.toLowerCase().includes(query) ||
        advisor.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      focus: {
        selected: selectedFocus,
        matches: (advisor: Advisor, value: string) => advisor.focus === value,
      },
      status: {
        selected: selectedStatus,
        matches: (advisor: Advisor, value: string) => advisor.status === value,
      },
    }),
    [selectedFocus, selectedStatus]
  )

  const filteredAdvisors = useMemo(
    () => filterItems(advisors, searchPass, groups),
    [advisors, searchPass, groups]
  )

  const focusCounts = useMemo(
    () =>
      optionCounts(
        filterItems(advisors, searchPass, groups, 'focus'),
        focusOptions,
        groups.focus.matches
      ),
    [advisors, searchPass, groups]
  )

  const statusCounts = useMemo(
    () =>
      optionCounts(
        filterItems(advisors, searchPass, groups, 'status'),
        statusOptions,
        groups.status.matches
      ),
    [advisors, searchPass, groups]
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
  }, [filteredAdvisors])

  return (
    <div className="flex gap-56px">
      <div className="width-9-col">
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search advisors by name or description"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredAdvisors.map(advisor => (
            <AdvisorCard
              key={advisor.id}
              advisor={advisor}
              placement={placements.get(advisor.id)}
            />
          ))}
          {filteredAdvisors.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile width-3-col">
        <FilterSidebar>
          <FilterGroup
            trackingPage="Advisors"
            title="Focus"
            options={focusOptions}
            selected={selectedFocus}
            counts={focusCounts}
            onToggle={v => toggleFilter(v, selectedFocus, setSelectedFocus)}
          />
          <FilterGroup
            trackingPage="Advisors"
            title="Status"
            options={statusOptions}
            selected={selectedStatus}
            counts={statusCounts}
            onToggle={v => toggleFilter(v, selectedStatus, setSelectedStatus)}
          />
        </FilterSidebar>
        <ContributeButtons
          trackingPage="Advisors"
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagTw6PRaIHUHh8ty/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="advisor"
          airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shr3u6yIAwM9Hi2fL"
          extraLinks={[
            {
              label: 'Review an advisor',
              url: 'https://airtable.com/appF8XfZUGXtfi40E/pagPIJgReOkrd1kEU/form',
            },
          ]}
        />
      </div>
    </div>
  )
}
