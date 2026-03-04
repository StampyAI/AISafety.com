'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import LastUpdated from '@/components/LastUpdated'
import FilterGroup from '@/components/FilterGroup'
import ContributeButtons from '@/components/ContributeButtons'

const skillSetOptions = [
  'Data',
  'Information security',
  'Legal',
  'Management',
  'Operations',
  'Other',
  'Outreach',
  'Policy',
  'Research',
  'Software engineering',
  'Strategy',
]

const experienceOptions = [
  'Entry level',
  'Junior (1–4 years experience)',
  'Mid (5–9 years experience)',
  'Senior (10+ years experience)',
]

const roleTypeOptions = [
  'Full-time',
  'Part-time',
  'Internship',
  'Fellowship',
  'Volunteering',
  'Funding',
]

const workLocationOptions = ['Remote', 'On-site']

interface Job {
  id: string
  name: string
  description: string
  organization: string
  logo: string | null
  skillSet: string
  location: string
  minimumExperience: string
  roleType: string
  workLocation: string
  url: string
  lastModified: string | null
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [selectedExperience, setSelectedExperience] = useState<Set<string>>(
    new Set()
  )
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [selectedWorkLocation, setSelectedWorkLocation] = useState<Set<string>>(
    new Set()
  )

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/jobs')
        if (!res.ok) throw new Error('Failed to fetch data')
        const data = await res.json()
        setJobs(data.records)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredJobs = jobs.filter(job => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !job.name.toLowerCase().includes(query) &&
        !job.organization.toLowerCase().includes(query) &&
        !job.location.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    if (selectedSkills.size > 0) {
      const jobSkills = job.skillSet
        .toLowerCase()
        .split(',')
        .map(s => s.trim())
      const hasMatch = Array.from(selectedSkills).some(s =>
        jobSkills.some(js => js.includes(s.toLowerCase()))
      )
      if (!hasMatch) return false
    }

    if (selectedExperience.size > 0) {
      const hasMatch = Array.from(selectedExperience).some(e =>
        job.minimumExperience.toLowerCase().includes(e.toLowerCase())
      )
      if (!hasMatch) return false
    }

    if (selectedRoles.size > 0) {
      const jobRoles = job.roleType
        .toLowerCase()
        .split(',')
        .map(r => r.trim())
      const hasMatch = Array.from(selectedRoles).some(r =>
        jobRoles.some(jr => jr.includes(r.toLowerCase()))
      )
      if (!hasMatch) return false
    }

    if (selectedWorkLocation.size > 0) {
      const hasMatch = Array.from(selectedWorkLocation).some(w =>
        job.workLocation.toLowerCase().includes(w.toLowerCase())
      )
      if (!hasMatch) return false
    }

    return true
  })

  const toggle = (
    value: string,
    selected: Set<string>,
    setter: (s: Set<string>) => void
  ) => {
    const next = new Set(selected)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    setter(next)
  }

  const skillCounts = jobs.reduce(
    (counts, job) => {
      const skills = job.skillSet
        .toLowerCase()
        .split(',')
        .map(s => s.trim())
      for (const option of skillSetOptions) {
        if (skills.some(s => s.includes(option.toLowerCase()))) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  const experienceCounts = jobs.reduce(
    (counts, job) => {
      for (const option of experienceOptions) {
        if (
          job.minimumExperience.toLowerCase().includes(option.toLowerCase())
        ) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  const roleCounts = jobs.reduce(
    (counts, job) => {
      const roles = job.roleType
        .toLowerCase()
        .split(',')
        .map(r => r.trim())
      for (const option of roleTypeOptions) {
        if (roles.some(r => r.includes(option.toLowerCase()))) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  const workLocationCounts = jobs.reduce(
    (counts, job) => {
      for (const option of workLocationOptions) {
        if (job.workLocation.toLowerCase().includes(option.toLowerCase())) {
          counts[option] = (counts[option] || 0) + 1
        }
      }
      return counts
    },
    {} as Record<string, number>
  )

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Jobs</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/jobs"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        Pursuing a career in AI safety can be{' '}
        <span className="color-light-teal">one of the most impactful ways</span>{' '}
        to contribute. Many roles don&apos;t require technical skills.
      </h2>

      {/* Database Grid */}
      <div className="database-outer-grid">
        <div>
          <div className="padding-bottom-40px">
            <input
              type="text"
              className="text-field"
              placeholder="Search jobs by title, organization, or location"
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
              {filteredJobs.map(job => (
                <a
                  key={job.id}
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                >
                  <div className="flex items-center gap-16px padding-bottom-24px">
                    <div className="featured-img">
                      {job.logo && (
                        <Image
                          src={job.logo}
                          alt=""
                          className="card-image"
                          width={64}
                          height={64}
                          unoptimized
                        />
                      )}
                    </div>
                    <div>
                      <p className="paragraph-xs-bold color-teal-400">
                        {job.organization}
                      </p>
                      <h3>{job.name}</h3>
                    </div>
                  </div>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Skill set
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {job.skillSet}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Location
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {job.location}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Minimum experience
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {job.minimumExperience}
                  </p>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Role type
                  </p>
                  <p className="paragraph-small">{job.roleType}</p>
                </a>
              ))}
              {filteredJobs.length === 0 && (
                <p className="paragraph-small color-teal-300">
                  No items found.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="hide-mobile">
          <FilterGroup
            title="Skill set"
            options={skillSetOptions}
            selected={Array.from(selectedSkills)}
            counts={skillCounts}
            onToggle={v => toggle(v, selectedSkills, setSelectedSkills)}
          />
          <FilterGroup
            title="Minimum experience"
            options={experienceOptions}
            selected={Array.from(selectedExperience)}
            counts={experienceCounts}
            onToggle={v => toggle(v, selectedExperience, setSelectedExperience)}
          />
          <FilterGroup
            title="Role type"
            options={roleTypeOptions}
            selected={Array.from(selectedRoles)}
            counts={roleCounts}
            onToggle={v => toggle(v, selectedRoles, setSelectedRoles)}
          />
          <FilterGroup
            title="Work location"
            options={workLocationOptions}
            selected={Array.from(selectedWorkLocation)}
            counts={workLocationCounts}
            onToggle={v =>
              toggle(v, selectedWorkLocation, setSelectedWorkLocation)
            }
          />
          <ContributeButtons
            suggestEntryUrl="https://airtable.com/appF8XfZUGXtfi40E/pagBI1UdaBbFplw20/form"
            suggestCorrectionUrl="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            noun="job"
          />
        </div>
      </div>
    </div>
  )
}
