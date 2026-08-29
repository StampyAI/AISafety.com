'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import FilterBar from '@/components/FilterBar'
import FilterDropdown from '@/components/FilterDropdown'
import ListingCard from '@/components/ListingCard'
import ContributeButtons from '@/components/ContributeButtons'
import { MediaChannel } from '@/lib/data/media-channels'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import { withUtm } from '@/lib/utm'
import { placementsById } from '@/lib/placements'

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

const allPass = () => true

export default function MediaChannelsClient({
  channels,
}: MediaChannelsClientProps) {
  const [typeFilters, setTypeFilters] = useState<string[]>([])

  // Each channel's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(channels), [channels])

  const groups = useMemo(
    () => ({
      type: {
        selected: typeFilters,
        matches: (channel: MediaChannel, value: string) =>
          channel.type
            .split(',')
            .map(t => t.trim())
            .includes(value),
      },
    }),
    [typeFilters]
  )

  const filteredChannels = useMemo(
    () => filterItems(channels, allPass, groups),
    [channels, groups]
  )

  const filterCounts = useMemo(
    () => ({
      type: optionCounts(
        filterItems(channels, allPass, groups, 'type'),
        typeOptions,
        groups.type.matches
      ),
    }),
    [channels, groups]
  )

  const savedScrollY = useRef<number | null>(null)

  const toggleFilter = (
    value: string,
    current: string[],
    setter: (v: string[]) => void
  ) => {
    savedScrollY.current = window.scrollY
    setter(
      current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
    )
  }

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredChannels])

  return (
    <>
      <FilterBar count={filteredChannels.length} noun="media source">
        <FilterDropdown
          trackingPage="Media channels"
          title="Type"
          icon="/images/icons/tag.svg"
          options={typeOptions}
          selected={typeFilters}
          counts={filterCounts.type}
          onToggle={v => toggleFilter(v, typeFilters, setTypeFilters)}
        />
      </FilterBar>

      <div className="flex gap-56px">
        <div className="collection-list padding-bottom-40px width-9-col">
          {filteredChannels.map(channel => (
            <ListingCard
              key={channel.id}
              href={channel.url !== '#' ? channel.url : undefined}
              name={channel.name}
              description={channel.description}
              logo={channel.logo}
              meta={
                channel.type
                  ? [{ icon: '/images/icons/tag.svg', value: channel.type }]
                  : []
              }
              trackingPage="Media channels"
              listingId={channel.id}
              placement={placements.get(channel.id)}
              trackingSource="cards"
            />
          ))}
          {filteredChannels.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>

        <div className="hide-mobile width-3-col">
          {/* Related resource — moved here from the featured row, since the
              full-width featured cards leave no room beside them. */}
          <div className="padding-bottom-40px">
            <p className="paragraph-small-bold padding-bottom-32px">
              Related resource
            </p>
            <a
              href={withUtm('https://aisafety.info', 'Media channels')}
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
          </div>
          <ContributeButtons
            trackingPage="Media channels"
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagSZ7vJj9MHyYmtS/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="media source"
            airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrK0YGL591cGcAE1"
          />
        </div>
      </div>
    </>
  )
}
