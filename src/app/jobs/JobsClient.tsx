'use client'

import {
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
} from 'react'
import Image from 'next/image'
import FilterGroup from '@/components/FilterGroup'
import FilterSidebar from '@/components/FilterSidebar'
import SearchBar from '@/components/SearchBar'
import { Job } from '@/lib/data/jobs'
import { trackListingClick } from '@/lib/analytics'
import { withUtm } from '@/lib/utm'
import { placementsById } from '@/lib/placements'
import { setPageContext } from '@/lib/assistant/page-context'
import { filterItems, optionCounts } from '@/lib/filter-counts'

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

const roleTypeOptions = ['Full-time', 'Part-time', 'Internship']

const workLocationOptions = ['Remote', 'On-site']

// 80k sometimes lists a region instead of a country ("Europe", "Various,
// Europe", "Remote (Europe)"). Those roles are available from any country
// in the region, so they match every member country in the filter. Only
// "Europe" appears in the data today; the other regions are listed so the
// same behavior kicks in automatically if 80k ever uses them.
const REGION_MEMBERS: Record<string, Set<string>> = {
  Europe: new Set([
    'UK',
    'Ireland',
    'France',
    'Germany',
    'Netherlands',
    'Belgium',
    'Luxembourg',
    'Switzerland',
    'Austria',
    'Denmark',
    'Norway',
    'Sweden',
    'Finland',
    'Iceland',
    'Spain',
    'Portugal',
    'Italy',
    'Greece',
    'Poland',
    'Czechia',
    'Czech Republic',
    'Slovakia',
    'Hungary',
    'Romania',
    'Bulgaria',
    'Croatia',
    'Serbia',
    'Slovenia',
    'Estonia',
    'Latvia',
    'Lithuania',
    'Ukraine',
  ]),
  Asia: new Set([
    'China',
    'India',
    'Japan',
    'Singapore',
    'South Korea',
    'Taiwan',
    'Hong Kong',
    'Indonesia',
    'Malaysia',
    'Thailand',
    'Vietnam',
    'Philippines',
    'Israel',
    'United Arab Emirates',
    'UAE',
    'Saudi Arabia',
    'Turkey',
  ]),
  'Middle East': new Set([
    'Israel',
    'United Arab Emirates',
    'UAE',
    'Saudi Arabia',
    'Qatar',
    'Turkey',
    'Jordan',
    'Egypt',
  ]),
  'North America': new Set(['USA', 'Canada', 'Mexico']),
  'Latin America': new Set([
    'Mexico',
    'Brazil',
    'Argentina',
    'Chile',
    'Colombia',
    'Peru',
    'Uruguay',
    'Costa Rica',
  ]),
  'South America': new Set([
    'Brazil',
    'Argentina',
    'Chile',
    'Colombia',
    'Peru',
    'Uruguay',
  ]),
  Africa: new Set([
    'South Africa',
    'Nigeria',
    'Kenya',
    'Ghana',
    'Egypt',
    'Morocco',
    'Rwanda',
    'Uganda',
  ]),
  Oceania: new Set(['Australia', 'New Zealand']),
}

const REGION_NAMES = Object.keys(REGION_MEMBERS)

const jobMatchesCountry = (job: Job, country: string) =>
  job.countries.includes(country) ||
  REGION_NAMES.some(
    region =>
      REGION_MEMBERS[region].has(country) && job.countries.includes(region)
  )

const degreeOptions = [
  'Undergraduate degree or less',
  "Master's degree",
  'Doctoral degree',
]

export default function JobsClient({ jobs }: JobsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedExperience, setSelectedExperience] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedWorkLocation, setSelectedWorkLocation] = useState<string[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedDegrees, setSelectedDegrees] = useState<string[]>([])
  const savedScrollY = useRef<number | null>(null)

  // Each job's slot in the full page order, stamped onto a click so the
  // dashboard can tie clicks to page position even after later reordering.
  const placements = useMemo(() => placementsById(jobs), [jobs])

  // Countries come from the data itself; only those with a meaningful
  // number of jobs get a checkbox, ordered by overall job count (the
  // order stays put while filtering). "Other" collects jobs in the
  // remaining countries.
  const countryOptions = useMemo(() => {
    const raw: Record<string, number> = {}
    for (const job of jobs) {
      for (const country of job.countries) {
        raw[country] = (raw[country] || 0) + 1
      }
    }
    const options = Object.keys(raw).filter(
      c => !(c in REGION_MEMBERS) && raw[c] >= 5
    )
    const totals: Record<string, number> = {}
    for (const option of options) {
      totals[option] = jobs.filter(job => jobMatchesCountry(job, option)).length
    }
    options.sort((a, b) => totals[b] - totals[a])
    options.push('Other')
    return options
  }, [jobs])

  const searchPass = useCallback(
    (job: Job) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        job.name.toLowerCase().includes(query) ||
        job.organization.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const groups = useMemo(() => {
    const named = new Set(countryOptions.filter(c => c !== 'Other'))
    return {
      skill: {
        selected: selectedSkills,
        matches: (job: Job, value: string) =>
          job.skillSet
            .split(',')
            .map(s => s.trim())
            .includes(value),
      },
      experience: {
        selected: selectedExperience,
        matches: (job: Job, value: string) =>
          job.minimumExperience
            .split(',')
            .map(e => e.trim())
            .includes(value),
      },
      role: {
        selected: selectedRoles,
        matches: (job: Job, value: string) =>
          job.roleType
            .split(',')
            .map(r => r.trim())
            .includes(value),
      },
      workLocation: {
        selected: selectedWorkLocation,
        matches: (job: Job, value: string) => job.workLocation === value,
      },
      country: {
        selected: selectedCountries,
        matches: (job: Job, value: string) =>
          value === 'Other'
            ? job.countries.some(c => !named.has(c))
            : jobMatchesCountry(job, value),
      },
      degree: {
        selected: selectedDegrees,
        matches: (job: Job, value: string) => job.requiredDegree === value,
      },
    }
  }, [
    selectedSkills,
    selectedExperience,
    selectedRoles,
    selectedWorkLocation,
    selectedCountries,
    selectedDegrees,
    countryOptions,
  ])

  const filteredJobs = useMemo(
    () => filterItems(jobs, searchPass, groups),
    [jobs, searchPass, groups]
  )

  const skillCounts = useMemo(
    () =>
      optionCounts(
        filterItems(jobs, searchPass, groups, 'skill'),
        skillSetOptions,
        groups.skill.matches
      ),
    [jobs, searchPass, groups]
  )

  const experienceCounts = useMemo(
    () =>
      optionCounts(
        filterItems(jobs, searchPass, groups, 'experience'),
        experienceOptions,
        groups.experience.matches
      ),
    [jobs, searchPass, groups]
  )

  const roleCounts = useMemo(
    () =>
      optionCounts(
        filterItems(jobs, searchPass, groups, 'role'),
        roleTypeOptions,
        groups.role.matches
      ),
    [jobs, searchPass, groups]
  )

  const workLocationCounts = useMemo(
    () =>
      optionCounts(
        filterItems(jobs, searchPass, groups, 'workLocation'),
        workLocationOptions,
        groups.workLocation.matches
      ),
    [jobs, searchPass, groups]
  )

  const countryCounts = useMemo(
    () =>
      optionCounts(
        filterItems(jobs, searchPass, groups, 'country'),
        countryOptions,
        groups.country.matches
      ),
    [jobs, searchPass, groups, countryOptions]
  )

  const degreeCounts = useMemo(
    () =>
      optionCounts(
        filterItems(jobs, searchPass, groups, 'degree'),
        degreeOptions,
        groups.degree.matches
      ),
    [jobs, searchPass, groups]
  )

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

  // Publish current filter + search state for the assistant to read
  useEffect(() => {
    const state: Record<string, unknown> = {}
    if (selectedSkills.length) state.skills = selectedSkills
    if (selectedExperience.length) state.experience = selectedExperience
    if (selectedRoles.length) state.roleTypes = selectedRoles
    if (selectedWorkLocation.length) state.workLocation = selectedWorkLocation
    if (selectedCountries.length) state.countries = selectedCountries
    if (selectedDegrees.length) state.requiredDegree = selectedDegrees
    if (searchQuery) state.search = searchQuery
    setPageContext({
      page: '/jobs',
      filters: Object.keys(state).length > 0 ? state : undefined,
    })
    return () => setPageContext(null)
  }, [
    selectedSkills,
    selectedExperience,
    selectedRoles,
    selectedWorkLocation,
    selectedCountries,
    selectedDegrees,
    searchQuery,
  ])

  return (
    <div className="flex gap-56px">
      <div className="width-9-col">
        <div className="padding-bottom-40px">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search jobs by title, organization, location, or description"
          />
        </div>

        <div className="collection-list padding-bottom-40px">
          {filteredJobs.map(job => (
            <a
              key={job.id}
              href={withUtm(job.url, 'Jobs')}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              onClick={() =>
                trackListingClick(
                  'Jobs',
                  `${job.name} – ${job.organization}`,
                  job.url,
                  job.id,
                  placements.get(job.id)
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
              {job.summary && (
                <p className="paragraph-small padding-bottom-16px">
                  {job.summary}
                </p>
              )}
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
                {job.locations.map(loc => (
                  <span key={loc} className="block">
                    {loc}
                  </span>
                ))}
              </p>
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Minimum experience
              </p>
              <p className="paragraph-small padding-bottom-16px">
                {job.minimumExperience}
              </p>
              {job.requiredDegree && (
                <>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Required degree
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {job.requiredDegree}
                  </p>
                </>
              )}
              {job.salary && (
                <>
                  <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                    Salary
                  </p>
                  <p className="paragraph-small padding-bottom-16px">
                    {job.salary}
                  </p>
                </>
              )}
              <p className="paragraph-xs-bold padding-bottom-4px color-teal-400">
                Role type
              </p>
              <p className="paragraph-small">{job.roleType}</p>
              {job.datePublished && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 'auto 24px 24px auto',
                    textAlign: 'right',
                  }}
                >
                  <span className="paragraph-xs color-teal-300 italic">
                    Posted:{' '}
                    {(() => {
                      const d = new Date(job.datePublished + 'T00:00:00')
                      return d.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
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

      <div className="hide-mobile width-3-col">
        <FilterSidebar>
          <FilterGroup
            trackingPage="Jobs"
            title="Skill set"
            options={skillSetOptions}
            selected={selectedSkills}
            counts={skillCounts}
            onToggle={v => toggleFilter(v, selectedSkills, setSelectedSkills)}
          />
          <FilterGroup
            trackingPage="Jobs"
            title="Minimum experience"
            options={experienceOptions}
            selected={selectedExperience}
            counts={experienceCounts}
            onToggle={v =>
              toggleFilter(v, selectedExperience, setSelectedExperience)
            }
          />
          <FilterGroup
            trackingPage="Jobs"
            title="Required degree"
            options={degreeOptions}
            selected={selectedDegrees}
            counts={degreeCounts}
            onToggle={v => toggleFilter(v, selectedDegrees, setSelectedDegrees)}
          />
          <FilterGroup
            trackingPage="Jobs"
            title="Role type"
            options={roleTypeOptions}
            selected={selectedRoles}
            counts={roleCounts}
            onToggle={v => toggleFilter(v, selectedRoles, setSelectedRoles)}
          />
          <FilterGroup
            trackingPage="Jobs"
            title="Location"
            options={countryOptions}
            selected={selectedCountries}
            counts={countryCounts}
            onToggle={v =>
              toggleFilter(v, selectedCountries, setSelectedCountries)
            }
          />
          <FilterGroup
            trackingPage="Jobs"
            title="Remote or on-site"
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
            href={withUtm('https://jobs.80000hours.org/', 'Jobs')}
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
