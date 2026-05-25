'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { MediaChannel } from '@/lib/data/media-channels'
import { trackListingClick } from '@/lib/analytics'

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

  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !channel.name.toLowerCase().includes(query) &&
          !channel.description.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (selectedTypes.length > 0) {
        const channelTypes = channel.type.split(',').map(t => t.trim())
        const hasMatch = selectedTypes.some(t => channelTypes.includes(t))
        if (!hasMatch) return false
      }

      return true
    })
  }, [channels, searchQuery, selectedTypes])

  const typeCounts = useMemo(() => {
    return channels.reduce(
      (counts, channel) => {
        const channelTypes = channel.type.split(',').map(t => t.trim())
        for (const option of typeOptions) {
          if (channelTypes.includes(option)) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [channels])

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
    <div className="database-outer-grid">
      <div>
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search sources by name or description"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredChannels.map(channel => (
            <a
              key={channel.id}
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              onClick={() =>
                trackListingClick('Media channels', channel.name, channel.url)
              }
            >
              <div className="flex items-center gap-16px padding-bottom-24px">
                <div className="featured-img">
                  {channel.logo && (
                    <Image
                      src={channel.logo}
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
                <h3>{channel.name}</h3>
              </div>
              <p className="paragraph-small padding-bottom-24px">
                {channel.description}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Type
              </p>
              <p className="paragraph-small">{channel.type}</p>
            </a>
          ))}
          {filteredChannels.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <FilterSidebar>
          <FilterGroup
            title="Type"
            options={typeOptions}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={toggleType}
          />
        </FilterSidebar>
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagSZ7vJj9MHyYmtS/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="media source"
          suggestEntryDescription="Suggest a resource to be published here"
          suggestCorrectionDescription="Let us know of changes to an entry"
        />
      </div>
    </div>
  )
}
