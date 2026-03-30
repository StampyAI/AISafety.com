'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'
import { FounderResource } from '@/lib/data/founders'

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

  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !resource.name.toLowerCase().includes(query) &&
          !resource.description.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (selectedTypes.length > 0) {
        const resourceType = resource.type.toLowerCase().trim()
        const hasMatch = selectedTypes.some(t =>
          resourceType.includes(t.toLowerCase())
        )
        if (!hasMatch) return false
      }

      return true
    })
  }, [resources, searchQuery, selectedTypes])

  const typeCounts = useMemo(() => {
    return resources.reduce(
      (counts, resource) => {
        const resourceType = resource.type.toLowerCase().trim()
        for (const option of typeOptions) {
          if (resourceType.includes(option.toLowerCase())) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [resources])

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
            placeholder="Search listings by name or description"
            maxLength={256}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredResources.map(resource => (
            <a
              key={resource.id}
              href={resource.website}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
            >
              <div className="flex items-center gap-16px padding-bottom-24px">
                <div className="featured-img">
                  {resource.image && (
                    <Image
                      src={resource.image}
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
                <h3>{resource.name}</h3>
              </div>
              <p className="paragraph-small padding-bottom-24px">
                {resource.description}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Type
              </p>
              <p className="paragraph-small">{resource.type}</p>
            </a>
          ))}
          {filteredResources.length === 0 && (
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
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pag1OO5TrQkO96W7R/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="resource"
        />
      </div>
    </div>
  )
}
