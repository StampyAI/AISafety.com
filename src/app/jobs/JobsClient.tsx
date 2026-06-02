'use client'

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import SearchBar from '@/components/SearchBar'
import { Job } from '@/lib/data/jobs'
import { trackListingClick } from '@/lib/analytics'

interface JobsClientProps {
  jobs: Job[]
}

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
  'Entry-level',
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

export default function JobsClient({ jobs }: JobsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedExperience, setSelectedExperience] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedWorkLocation, setSelectedWorkLocation] = useState<string[]>([])
  const savedScrollY = useRef<number | null>(null)

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
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

      if (selectedSkills.length > 0) {
        const jobSkills = job.skillSet.split(',').map(s => s.trim())
        const hasMatch = selectedSkills.some(s => jobSkills.includes(s))
        if (!hasMatch) return false
      }

      if (selectedExperience.length > 0) {
        const jobExperience = job.minimumExperience
          .split(',')
          .map(e => e.trim())
        const hasMatch = selectedExperience.some(e => jobExperience.includes(e))
        if (!hasMatch) return false
      }

      if (selectedRoles.length > 0) {
        const jobRoles = job.roleType.split(',').map(r => r.trim())
        const hasMatch = selectedRoles.some(r => jobRoles.includes(r))
        if (!hasMatch) return false
      }

      if (selectedWorkLocation.length > 0) {
        if (!selectedWorkLocation.includes(job.workLocation)) return false
      }

      return true
    })
  }, [
    jobs,
    searchQuery,
    selectedSkills,
    selectedExperience,
    selectedRoles,
    selectedWorkLocation,
  ])

  const skillCounts = useMemo(() => {
    return jobs.reduce(
      (counts, job) => {
        const skills = job.skillSet.split(',').map(s => s.trim())
        for (const option of skillSetOptions) {
          if (skills.includes(option)) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [jobs])

  const experienceCounts = useMemo(() => {
    return jobs.reduce(
      (counts, job) => {
        const jobExperience = job.minimumExperience
          .split(',')
          .map(e => e.trim())
        for (const option of experienceOptions) {
          if (jobExperience.includes(option)) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [jobs])

  const roleCounts = useMemo(() => {
    return jobs.reduce(
      (counts, job) => {
        const roles = job.roleType.split(',').map(r => r.trim())
        for (const option of roleTypeOptions) {
          if (roles.includes(option)) {
            counts[option] = (counts[option] || 0) + 1
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [jobs])

  const workLocationCounts = useMemo(() => {
    return jobs.reduce(
      (counts, job) => {
        for (const option of workLocationOptions) {
          if (job.workLocation === option) {
            counts[option] = (counts[option] || 0) + 1
            break
          }
        }
        return counts
      },
      {} as Record<string, number>
    )
  }, [jobs])

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
  }, [filteredJobs])

  return (
    <div className="database-outer-grid">
      <div>
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search jobs by title, organization, or location"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredJobs.map(job => (
            <a
              key={job.id}
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              onClick={() =>
                trackListingClick(
                  'Jobs',
                  `${job.name} – ${job.organization}`,
                  job.url
                )
              }
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
                      loading="eager"
                      onError={e => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                </div>
                <div>
                  <h3>{job.name}</h3>
                  <p className="paragraph-small color-teal-300">
                    {job.organization}
                  </p>
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
              {job.datePublished && (
                <div className="date-published">
                  <span className="paragraph-xs color-teal-300 italic">
                    Posted:{' '}
                    {(() => {
                      const d = new Date(job.datePublished + 'T00:00:00')
                      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
                    })()}
                  </span>
                </div>
              )}
            </a>
          ))}
          {filteredJobs.length === 0 && (
            <p className="paragraph-small color-teal-300">Nothing found.</p>
          )}
        </div>
      </div>

      <div className="hide-mobile">
        <FilterSidebar>
          <FilterGroup
            title="Skill set"
            options={skillSetOptions}
            selected={selectedSkills}
            counts={skillCounts}
            onToggle={v => toggleFilter(v, selectedSkills, setSelectedSkills)}
          />
          <FilterGroup
            title="Minimum experience"
            options={experienceOptions}
            selected={selectedExperience}
            counts={experienceCounts}
            onToggle={v =>
              toggleFilter(v, selectedExperience, setSelectedExperience)
            }
          />
          <FilterGroup
            title="Role type"
            options={roleTypeOptions}
            selected={selectedRoles}
            counts={roleCounts}
            onToggle={v => toggleFilter(v, selectedRoles, setSelectedRoles)}
          />
          <FilterGroup
            title="Work location"
            options={workLocationOptions}
            selected={selectedWorkLocation}
            counts={workLocationCounts}
            onToggle={v =>
              toggleFilter(v, selectedWorkLocation, setSelectedWorkLocation)
            }
          />
        </FilterSidebar>
        <div>
          <p className="paragraph-small padding-bottom-4px padding-top-56px">
            Source:
          </p>
          <a
            href="https://jobs.80000hours.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="color-light-teal"
          >
            80,000 Hours Job Board
          </a>
        </div>
      </div>
    </div>
  )
}
