'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'
import { MediaChannel } from '@/lib/data/media-channels'

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
        const hasMatch = selectedTypes.some(t =>
          channel.type.toLowerCase().includes(t.toLowerCase())
        )
        if (!hasMatch) return false
      }

      return true
    })
  }, [channels, searchQuery, selectedTypes])

  const typeCounts = useMemo(() => {
    return channels.reduce(
      (counts, channel) => {
        for (const option of typeOptions) {
          if (channel.type.toLowerCase().includes(option.toLowerCase())) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [channels])

  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type))
    } else {
      setSelectedTypes([...selectedTypes, type])
    }
  }

  return (
    <div className="database-outer-grid">
      <div>
        <div className="padding-bottom-40px">
          <input
            type="text"
            className="text-field"
            placeholder="Search sources by name or description"
            maxLength={256}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
            <p className="paragraph-small color-teal-300">No items found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <div className="flex flex-col gap-40px">
          <FilterGroup
            title="Type"
            options={typeOptions}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={toggleType}
          />
        </div>
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagSZ7vJj9MHyYmtS/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="media source"
          suggestEntryDescription="Suggest an information source to be listed here"
          suggestCorrectionDescription="Let us know of changes to an entry"
        />
      </div>
    </div>
  )
}
