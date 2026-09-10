'use client'

import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import SearchBar from '@/components/SearchBar'
import { Project } from '@/lib/data/projects'
import { filterItems, optionCounts } from '@/lib/filter-counts'
import ProjectCard from './ProjectCard'

interface ProjectsClientProps {
  projects: Project[]
}

const statusOptions = ['Active', 'Paused', 'Seeking owner']

export default function ProjectsClient({ projects }: ProjectsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])

  const searchPass = useCallback(
    (project: Project) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(
    () => ({
      status: {
        selected: selectedStatus,
        matches: (project: Project, value: string) => project.status === value,
      },
    }),
    [selectedStatus]
  )

  const filteredProjects = useMemo(
    () => filterItems(projects, searchPass, groups),
    [projects, searchPass, groups]
  )

  const statusCounts = useMemo(
    () =>
      optionCounts(
        filterItems(projects, searchPass, groups, 'status'),
        statusOptions,
        groups.status.matches
      ),
    [projects, searchPass, groups]
  )

  const savedScrollY = useRef<number | null>(null)

  const toggleStatus = (status: string) => {
    savedScrollY.current = window.scrollY
    if (selectedStatus.includes(status)) {
      setSelectedStatus(selectedStatus.filter(s => s !== status))
    } else {
      setSelectedStatus([...selectedStatus, status])
    }
  }

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo(0, savedScrollY.current)
      savedScrollY.current = null
    }
  }, [filteredProjects])

  return (
    <div className="flex gap-56px">
      <div className="width-9-col">
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search projects by name or description"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {filteredProjects.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile width-3-col">
        <FilterSidebar>
          <FilterGroup
            trackingPage="Projects"
            title="Status"
            options={statusOptions}
            selected={selectedStatus}
            counts={statusCounts}
            onToggle={toggleStatus}
          />
        </FilterSidebar>
        <ContributeButtons
          trackingPage="Projects"
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagudvyKXZISztcOI/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="project"
          airtableUrl="https://airtable.com/appF8XfZUGXtfi40E/shrSOZFEW790ANG0Q"
        />
      </div>
    </div>
  )
}
