import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import JobsClient from './JobsClient'
import { getJobs } from '@/lib/data/jobs'

export const metadata = {
  title: 'Jobs – AISafety.com',
  description:
    "AI safety career opportunities. Many roles don't require technical skills.",
  alternates: { canonical: '/jobs' },
}

export default async function JobsPage() {
  const [jobs, lastUpdated] = await Promise.all([
    getJobs(),
    fetchLastUpdated('jobs'),
  ])

  return (
    <div className="container-default">
      <PageHeader
        title="Jobs"
        lastUpdated={lastUpdated.formattedDate}
        description={
          <>
            Pursuing a career in AI safety can be{' '}
            <span className="color-light-teal">
              one of the most impactful ways
            </span>{' '}
            to contribute. Many roles don&apos;t require technical skills.
          </>
        }
      />

      {/* Main Content with Search, Cards, and Filters */}
      <JobsClient jobs={jobs} />
    </div>
  )
}
