'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'

const statusOptions = ['Active', 'Paused', 'Seeking owner']

interface Project {
  id: string
  name: string
  description: string
  logo: string | null
  contact: string
  status: string
  url: string
  lastModified: string | null
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) throw new Error('Failed to fetch data')
        const data = await res.json()
        setProjects(data.records)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredProjects = projects.filter(project => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !project.name.toLowerCase().includes(query) &&
        !project.description.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    if (selectedStatus.size > 0) {
      const hasMatch = Array.from(selectedStatus).some(s =>
        project.status.toLowerCase().includes(s.toLowerCase())
      )
      if (!hasMatch) return false
    }

    return true
  })

  const toggleStatus = (status: string) => {
    const next = new Set(selectedStatus)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    setSelectedStatus(next)
  }

  const statusCounts = projects.reduce(
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

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">
        Volunteer projects
      </h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/projects"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        Initiatives{' '}
        <span className="color-light-teal">seeking your volunteer help</span>.
        These projects are focused on supporting and improving the AI safety
        field.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://huggingface.co/datasets/StampyAI/alignment-research-dataset"
            tagline="Seeking maintainer"
            name="Alignment Research Dataset"
            description='Regularly scrapes all major sources of alignment data for use by the AI Safety Chatbot and other projects. Currently needs someone to maintain it. Search "alignment research dataset" on Hugging Face for details.'
            logo="/images/download-2-1.svg"
            metadata={[
              { label: 'Contact', value: 'Olivier Coutu' },
              { label: 'Status', value: 'Active' },
            ]}
          />
          <FeaturedCard
            href="https://aisafetyfeed.com/"
            tagline="Content curation platform"
            name="AI Safety Feed"
            description="A curated stream for AI safety content, gathering posts and research from key sources. AI helps summarize, tag, and rate content for novelty, letting users quickly find what's important and relevant to them."
            logo="/images/download-2-1.svg"
            metadata={[
              { label: 'Contact', value: 'Matt Brooks' },
              { label: 'Status', value: 'Active' },
            ]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://discord.com/invite/BfwQq2FTqE"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              AED Discord <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              A hub connecting AI safety volunteers and projects
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
              placeholder="Search projects by name or description"
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
              {filteredProjects.map(project => (
                <a
                  key={project.id}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                >
                  <div className="flex items-center gap-16px padding-bottom-24px">
                    <div className="featured-img">
                      {project.logo && (
                        <Image
                          src={project.logo}
                          alt=""
                          className="card-image"
                          width={64}
                          height={64}
                          unoptimized
                        />
                      )}
                    </div>
                    <h3>{project.name}</h3>
                  </div>
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
                <p className="paragraph-small color-teal-300">
                  No items found.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="hide-mobile">
          <FilterGroup
            title="Status"
            options={statusOptions}
            selected={Array.from(selectedStatus)}
            counts={statusCounts}
            onToggle={toggleStatus}
          />
          <ContributeButtons
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagudvyKXZISztcOI/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="project"
          />
        </div>
      </div>
    </div>
  )
}
