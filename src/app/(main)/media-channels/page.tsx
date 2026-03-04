'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'

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

interface MediaChannel {
  id: string
  name: string
  description: string
  logo: string | null
  type: string
  url: string
  lastModified: string | null
}

export default function MediaChannelsPage() {
  const [channels, setChannels] = useState<MediaChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/media-channels')
        if (!res.ok) throw new Error('Failed to fetch data')
        const data = await res.json()
        setChannels(data.records)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredChannels = channels.filter(channel => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !channel.name.toLowerCase().includes(query) &&
        !channel.description.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    if (selectedTypes.size > 0) {
      const hasMatch = Array.from(selectedTypes).some(t =>
        channel.type.toLowerCase().includes(t.toLowerCase())
      )
      if (!hasMatch) return false
    }

    return true
  })

  const toggleType = (type: string) => {
    const next = new Set(selectedTypes)
    if (next.has(type)) {
      next.delete(type)
    } else {
      next.add(type)
    }
    setSelectedTypes(next)
  }

  const typeCounts = channels.reduce(
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

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Media channels</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/media-channels"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        <span className="color-light-teal">
          The AI safety space is changing rapidly.
        </span>{' '}
        These information sources can help you learn more and stay up to date.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://www.transformernews.ai/"
            tagline="Top newsletter recommendation"
            name="Transformer"
            description="Aims to help decision-makers understand what's happening in AI and why it matters, through news roundups, explainers, features, and opinion pieces."
            logo="/images/download-2-1.svg"
            metadata={[{ label: 'Type', value: 'Newsletter' }]}
          />
          <FeaturedCard
            href="https://www.youtube.com/playlist?list=PLWQikawCP4UFM_ziLf9X2rcOLCSbqisRE"
            tagline="Top recommended videos"
            name="AI Safety Playlist"
            description="A carefully curated and regularly updated YouTube playlist to help people gain an understanding of what's going on with AI."
            logo="/images/download-2-1.svg"
            metadata={[{ label: 'Type', value: 'YouTube' }]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://aisafetyfeed.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block padding-bottom-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              AI Safety Feed <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Web app curating content from various sources
            </p>
          </a>
          <a
            href="https://aisafety.info"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              AISafety.info <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              A comprehensive FAQ on various AI safety topics, written and
              curated by our team and affiliates
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
              placeholder="Search sources by name or description"
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
                <p className="paragraph-small color-teal-300">
                  No items found.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="hide-mobile">
          <FilterGroup
            title="Type"
            options={typeOptions}
            selected={Array.from(selectedTypes)}
            counts={typeCounts}
            onToggle={toggleType}
          />
          <ContributeButtons
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="media source"
          />
        </div>
      </div>
    </div>
  )
}
