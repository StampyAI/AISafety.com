'use client'

import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { MediaChannel } from '@/lib/data/media-channels'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { placementsById } from '@/lib/placements'
import MediaChannelCard from './MediaChannelCard'

interface MediaChannelsClientProps {
  channels: MediaChannel[]
}

const typeOptions = [
  'Article',
  'Blog',
  'Book',
  'Forum',
  'Newsletter',
  'Podcast',
  'Twitter/X list',
  'YouTube channel',
]

export default function MediaChannelsClient({
  channels,
}: MediaChannelsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  // Each channel's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(channels), [channels])

  const searchPass = useCallback(
    (channel: MediaChannel) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        channel.name.toLowerCase().includes(query) ||
        channel.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      type: {
        selected: selectedTypes,
        matches: (channel: MediaChannel, value: string) =>
          channel.type
            .split(',')
            .map(t => t.trim())
            .includes(value),
      },
    }),
    [selectedTypes]
  )

  const filteredChannels = useMemo(
    () => filterItems(channels, searchPass, groups),
    [channels, searchPass, groups]
  )

  const typeCounts = useMemo(
    () =>
      optionCounts(
        filterItems(channels, searchPass, groups, 'type'),
        typeOptions,
        groups.type.matches
      ),
    [channels, searchPass, groups]
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
  }, [filteredChannels])

  return (
    <div className="flex gap-56px">
      <div className="width-9-col">
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search sources by name or description"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredChannels.map(channel => (
            <MediaChannelCard
              key={channel.id}
              channel={channel}
              placement={placements.get(channel.id)}
            />
          ))}
          {filteredChannels.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile width-3-col">
        <FilterSidebar>
          <FilterGroup
            trackingPage="Media channels"
            title="Type"
            options={typeOptions}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={toggleType}
          />
        </FilterSidebar>
        <ContributeButtons
          trackingPage="Media channels"
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagSZ7vJj9MHyYmtS/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="media source"
          airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrK0YGL591cGcAE1"
        />
      </div>
    </div>
  )
}
