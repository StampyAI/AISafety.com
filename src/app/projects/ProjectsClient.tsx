'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import ContributeButtons from '@/components/ContributeButtons'
import { Project } from '@/lib/data/projects'

interface ProjectsClientProps {
  projects: Project[]
}

const statusOptions = ['Active', 'Paused', 'Seeking owner']

export default function ProjectsClient({ projects }: ProjectsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !project.name.toLowerCase().includes(query) &&
          !project.description.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (selectedStatus.length > 0) {
        if (!selectedStatus.includes(project.status)) return false
      }

      return true
    })
  }, [projects, searchQuery, selectedStatus])

  const statusCounts = useMemo(() => {
    return projects.reduce(
      (counts, project) => {
        for (const option of statusOptions) {
          if (project.status === option) {
            counts[option] = (counts[option] || 0) + 1
            break
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [projects])

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
    <div className="database-outer-grid">
      <div>
        <div className="padding-bottom-40px">
          <input
            type="text"
            className="text-field"
            placeholder="Search projects by name or description"
            maxLength={256}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredProjects.map(project => (
            <div key={project.id} className="card card-static">
              <h3 className="padding-bottom-24px">{project.name}</h3>
              <p className="paragraph-small padding-bottom-24px">
                {project.description}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Contact
              </p>
              <p className="paragraph-small">{project.contact}</p>
              {project.email && (
                <p className="paragraph-small">{project.email}</p>
              )}
              <p className="paragraph-xs-bold padding-top-16px padding-bottom-4px color-teal-400">
                Status
              </p>
              <p className="paragraph-small">{project.status}</p>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <FilterSidebar>
          <FilterGroup
            title="Status"
            options={statusOptions}
            selected={selectedStatus}
            counts={statusCounts}
            onToggle={toggleStatus}
          />
        </FilterSidebar>
        <ContributeButtons
          suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagudvyKXZISztcOI/form"
          suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
          noun="project"
          suggestCorrectionDescription="Propose changes to a project listing"
        />
      </div>
    </div>
  )
}
