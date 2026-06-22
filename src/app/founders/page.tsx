import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCard'
import FoundersClient from './FoundersClient'
import { getFounderResources } from '@/lib/data/founders'

export const metadata = {
  title: 'Founder Toolkit – AISafety.com',
  description:
    'Resources for starting and growing an AI safety organization, including incubators, fiscal sponsors, VCs, and practical tools.',
  alternates: { canonical: '/founders' },
}

export default async function FoundersPage() {
  const [resources, lastUpdated] = await Promise.all([
    getFounderResources(),
    fetchLastUpdated('founders'),
  ])

  return (
    <div className="container-default">
      <PageHeader
        title="Founder toolkit"
        lastUpdated={lastUpdated.formattedDate}
        description={
          <>
            Resources for{' '}
            <span className="color-light-teal">starting and growing</span> an AI
            safety organization – including incubators, fiscal sponsors, VCs,
            and practical tools.
          </>
        }
      />

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          {[
            resources.find(r => r.featured === '1'),
            resources.find(r => r.featured === '2'),
          ]
            .filter((r): r is NonNullable<typeof r> => r != null)
            .map(resource => (
              <FeaturedCard
                key={resource.id}
                href={resource.website !== '#' ? resource.website : undefined}
                tagline={resource.featuredTagline!}
                name={resource.name}
                description={resource.description}
                logo={resource.image ?? undefined}
                metadata={[{ label: 'Type', value: resource.type }]}
                trackingPage="Founders"
                trackingPosition={`F${resource.featured}`}
              />
            ))}
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <Link
            href="/funding"
            className="block padding-bottom-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              Funding <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Organizations offering financial support to AI safety projects and
              individuals
            </p>
          </Link>
          <Link href="/events-and-training" className="block hover-opacity-80">
            <h3 className="padding-bottom-16px">
              Events &amp; Training{' '}
              <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Upcoming fellowships, conferences, facilitated courses etc.
            </p>
          </Link>
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <FoundersClient resources={resources} />
    </div>
  )
}
