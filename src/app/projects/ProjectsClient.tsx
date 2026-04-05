'use client'

import { useState, useMemo } from 'react'
import FilterGroup from '@/components/FilterGroup'
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
        const hasMatch = selectedStatus.some(s =>
          project.status.toLowerCase().includes(s.toLowerCase())
        )
        if (!hasMatch) return false
      }

      return true
    })
  }, [projects, searchQuery, selectedStatus])

  const statusCounts = useMemo(() => {
    return projects.reduce(
      (counts, project) => {
        for (const option of statusOptions) {
          if (project.status.toLowerCase().includes(option.toLowerCase())) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [projects])

  const toggleStatus = (status: string) => {
    if (selectedStatus.includes(status)) {
      setSelectedStatus(selectedStatus.filter(s => s !== status))
    } else {
      setSelectedStatus([...selectedStatus, status])
    }
  }

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
            <a
              key={project.id}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
            >
              <h3 className="padding-bottom-24px">{project.name}</h3>
              <p className="paragraph-small padding-bottom-24px">
                {project.description}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Contact
              </p>
              <p className="paragraph-small padding-bottom-16px">
                {project.contact}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Status
              </p>
              <p className="paragraph-small">{project.status}</p>
            </a>
          ))}
          {filteredProjects.length === 0 && (
            <p className="paragraph-small color-teal-300">No items found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <div className="flex flex-col gap-40px">
          <FilterGroup
            title="Status"
            options={statusOptions}
            selected={selectedStatus}
            counts={statusCounts}
            onToggle={toggleStatus}
          />
        </div>
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
