'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import FilterBar from '@/components/FilterBar'
import FilterDropdown from '@/components/FilterDropdown'
import ListingCard from '@/components/ListingCard'
import ContributeButtons from '@/components/ContributeButtons'
import type { Course } from '@/lib/data/self-study'
import { placementsById } from '@/lib/placements'

interface SelfStudyClientProps {
  courses: Course[]
}

// Must match the raw values stored in Airtable's Focus/Format fields.
const categoryOptions = [
  'General intro',
  'Technical alignment',
  'Governance',
  'Strategy',
]

const typeOptions = ['Curriculum', 'Reading list']

export default function SelfStudyClient({ courses }: SelfStudyClientProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  // Each course's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(courses), [courses])

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
    <>
      {/* FilterBar lives above the grid (not inside the left column) so the
          cards and the Contribute/Airtable column both start at the same top. */}
      <FilterBar count={filteredCourses.length} noun="course">
        <FilterDropdown
          trackingPage="Self-study"
          title="Focus"
          icon="/images/icons/category.svg"
          options={categoryOptions}
          selected={selectedCategories}
          counts={categoryCounts}
          onToggle={v =>
            toggleFilter(v, selectedCategories, setSelectedCategories)
          }
        />
        <FilterDropdown
          trackingPage="Self-study"
          title="Format"
          icon="/images/icons/type.svg"
          options={typeOptions}
          selected={selectedTypes}
          counts={typeCounts}
          onToggle={v => toggleFilter(v, selectedTypes, setSelectedTypes)}
        />
      </FilterBar>

      <div className="flex gap-56px">
        <div className="collection-list padding-bottom-40px width-9-col">
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
                        icon: '/images/icons/author.svg',
                        value: `By ${course.organizer}`,
                      },
                    ]
                  : undefined
              }
              meta={[
                ...(course.category
                  ? [
                      {
                        icon: '/images/icons/category.svg',
                        value: course.category,
                      },
                    ]
                  : []),
                ...(course.courseType
                  ? [
                      {
                        icon: '/images/icons/type.svg',
                        value: course.courseType,
                      },
                    ]
                  : []),
              ]}
              trackingPage="Self-study"
              listingId={course.id}
              placement={placements.get(course.id)}
            />
          ))}
          {filteredCourses.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>

        <div className="hide-mobile width-3-col">
          <ContributeButtons
            trackingPage="Self-study"
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pag6L4BzdkxocBzqr/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="course"
            airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrOkWNUJKcfgCSiB"
          />
        </div>
      </div>
    </>
  )
}
