'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import type { Course } from '@/lib/data/self-study'
import {
  displayCategory,
  categoryDisplayLabels,
  typeDisplayLabels,
} from '@/lib/data/self-study-labels'
import { trackListingClick } from '@/lib/analytics'

interface SelfStudyClientProps {
  courses: Course[]
}

const categoryOptions = [
  'Introductory',
  'Technical Alignment',
  'Governance',
  'Strategy',
]

const typeOptions = ['Curriculum', 'Reading List']

export default function SelfStudyClient({ courses }: SelfStudyClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !course.name.toLowerCase().includes(query) &&
          !course.description.toLowerCase().includes(query) &&
          !course.organizer.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (selectedCategories.length > 0) {
        const courseCategories = course.category.split(',').map(c => c.trim())
        const hasMatchingCategory = selectedCategories.some(cat =>
          courseCategories.includes(cat)
        )
        if (!hasMatchingCategory) return false
      }

      if (selectedTypes.length > 0) {
        const courseTypes = course.courseType.split(',').map(t => t.trim())
        const hasMatchingType = selectedTypes.some(t => courseTypes.includes(t))
        if (!hasMatchingType) return false
      }

      return true
    })
  }, [courses, searchQuery, selectedCategories, selectedTypes])

  const categoryCounts = useMemo(() => {
    return courses.reduce(
      (counts, course) => {
        const courseCategories = course.category.split(',').map(c => c.trim())
        for (const category of categoryOptions) {
          if (courseCategories.includes(category)) {
            counts[category] = (counts[category] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [courses])

  const typeCounts = useMemo(() => {
    return courses.reduce(
      (counts, course) => {
        const courseTypes = course.courseType.split(',').map(t => t.trim())
        for (const type of typeOptions) {
          if (courseTypes.includes(type)) {
            counts[type] = (counts[type] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [courses])

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
  }, [filteredCourses])

  return (
    <div className="database-outer-grid">
      <div>
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search courses by name, description, or creator"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredCourses.map(course => (
            <a
              key={course.id}
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              onClick={() =>
                trackListingClick('Self-study', course.name, course.url)
              }
            >
              <div className="flex items-center gap-16px padding-bottom-24px">
                <div className="featured-img">
                  {course.image && (
                    <Image
                      src={course.image}
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
                <h3>{course.name}</h3>
              </div>
              <p className="paragraph-small padding-bottom-24px">
                {course.description}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Focus
              </p>
              <p className="paragraph-small padding-bottom-16px">
                {displayCategory(course.category)}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Created by
              </p>
              <p className="paragraph-small">{course.organizer}</p>
            </a>
          ))}
          {filteredCourses.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <FilterSidebar>
          <FilterGroup
            title="Focus"
            options={categoryOptions}
            labels={categoryDisplayLabels}
            selected={selectedCategories}
            counts={categoryCounts}
            onToggle={v =>
              toggleFilter(v, selectedCategories, setSelectedCategories)
            }
          />
          <FilterGroup
            title="Format"
            options={typeOptions}
            labels={typeDisplayLabels}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={v => toggleFilter(v, selectedTypes, setSelectedTypes)}
          />
        </FilterSidebar>
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pag6L4BzdkxocBzqr/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="course"
        />
      </div>
    </div>
  )
}
