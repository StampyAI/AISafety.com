'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import FilterBar from '@/components/FilterBar'
import FilterDropdown from '@/components/FilterDropdown'
import ListingCard from '@/components/ListingCard'
import ContributeButtons from '@/components/ContributeButtons'
import { Course } from '@/lib/data/self-study'

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      if (selectedCategories.length > 0) {
        const courseCategories = course.category.split(',').map(c => c.trim())
        if (!selectedCategories.some(cat => courseCategories.includes(cat))) {
          return false
        }
      }

      if (selectedTypes.length > 0) {
        const courseTypes = course.courseType.split(',').map(t => t.trim())
        if (!selectedTypes.some(t => courseTypes.includes(t))) {
          return false
        }
      }

      return true
    })
  }, [courses, selectedCategories, selectedTypes])

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

  // Preserve scroll position when toggling a filter re-renders the list.
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
  }, [filteredCourses])

  return (
    <div className="database-outer-grid">
      <div>
        <FilterBar count={filteredCourses.length} noun="course">
          <FilterDropdown
            title="Category"
            icon="/images/category.svg"
            options={categoryOptions}
            selected={selectedCategories}
            counts={categoryCounts}
            onToggle={v =>
              toggleFilter(v, selectedCategories, setSelectedCategories)
            }
          />
          <FilterDropdown
            title="Type"
            icon="/images/type.svg"
            options={typeOptions}
            selected={selectedTypes}
            counts={typeCounts}
            onToggle={v => toggleFilter(v, selectedTypes, setSelectedTypes)}
          />
        </FilterBar>

        <div className="collection-list padding-bottom-40px">
          {filteredCourses.map(course => (
            <ListingCard
              key={course.id}
              href={course.url}
              name={course.name}
              description={course.description}
              logo={course.image}
              titleMeta={
                course.organizer
                  ? [
                      {
                        icon: '/images/author.svg',
                        value: `By ${course.organizer}`,
                      },
                    ]
                  : undefined
              }
              meta={[
                ...(course.category
                  ? [{ icon: '/images/category.svg', value: course.category }]
                  : []),
                ...(course.courseType
                  ? [{ icon: '/images/type.svg', value: course.courseType }]
                  : []),
              ]}
              trackingPage="Self-study"
            />
          ))}
          {filteredCourses.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pag6L4BzdkxocBzqr/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="course"
        />
      </div>
    </div>
  )
}
