'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'
import { Advisor } from '../../api/advisors/route'

interface AdvisorsClientProps {
  advisors: Advisor[]
}

const focusOptions = ['Career/contribution', 'Other']
const statusOptions = ['Active', 'Inactive']

export default function AdvisorsClient({ advisors }: AdvisorsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFocus, setSelectedFocus] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])

  const filteredAdvisors = useMemo(() => {
    return advisors.filter(advisor => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !advisor.name.toLowerCase().includes(query) &&
          !advisor.description.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (selectedFocus.length > 0) {
        const hasMatch = selectedFocus.some(f =>
          advisor.focus.toLowerCase().includes(f.toLowerCase())
        )
        if (!hasMatch) return false
      }

      if (selectedStatus.length > 0) {
        const hasMatch = selectedStatus.some(s =>
          advisor.status.toLowerCase().includes(s.toLowerCase())
        )
        if (!hasMatch) return false
      }

      return true
    })
  }, [advisors, searchQuery, selectedFocus, selectedStatus])

  const focusCounts = useMemo(() => {
    return advisors.reduce(
      (counts, advisor) => {
        for (const option of focusOptions) {
          if (advisor.focus.toLowerCase().includes(option.toLowerCase())) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [advisors])

  const statusCounts = useMemo(() => {
    return advisors.reduce(
      (counts, advisor) => {
        for (const option of statusOptions) {
          if (advisor.status.toLowerCase().includes(option.toLowerCase())) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [advisors])

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
            placeholder="Search advisors by name or description"
            maxLength={256}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredAdvisors.map(advisor => (
            <a
              key={advisor.id}
              href={advisor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
            >
              <div className="flex items-center gap-16px padding-bottom-24px">
                <div className="featured-img">
                  {advisor.logo && (
                    <Image
                      src={advisor.logo}
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
                <h3>{advisor.name}</h3>
              </div>
              <p className="paragraph-small padding-bottom-24px">
                {advisor.description}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Focus
              </p>
              <p className="paragraph-small padding-bottom-16px">
                {advisor.focus}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Status
              </p>
              <p className="paragraph-small">{advisor.status}</p>
            </a>
          ))}
          {filteredAdvisors.length === 0 && (
            <p className="paragraph-small color-teal-300">No items found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <FilterGroup
          title="Focus"
          options={focusOptions}
          selected={selectedFocus}
          counts={focusCounts}
          onToggle={v => toggleFilter(v, selectedFocus, setSelectedFocus)}
        />
        <FilterGroup
          title="Status"
          options={statusOptions}
          selected={selectedStatus}
          counts={statusCounts}
          onToggle={v => toggleFilter(v, selectedStatus, setSelectedStatus)}
        />
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="advisor"
        />
      </div>
    </div>
  )
}
