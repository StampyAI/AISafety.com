import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCard'
import AdvisorsClient from './AdvisorsClient'
import { getAdvisors } from '@/lib/data/advisors'

export const metadata = {
  title: 'Advisors – AISafety.com',
  description:
    'Advisors offering free guidance calls to help you most effectively contribute to AI safety.',
  alternates: { canonical: '/advisors' },
}

export default async function AdvisorsPage() {
  const [advisors, lastUpdated] = await Promise.all([
    getAdvisors(),
    fetchLastUpdated('advisors'),
  ])

  return (
    <div className="container-default">
      <PageHeader
        title="Advisors"
        lastUpdated={lastUpdated.formattedDate}
        description={
          <>
            <span className="color-light-teal">
              Connecting with human experts can be invaluable.
            </span>{' '}
            These advisors offer free guidance calls to help you most
            effectively contribute to AI safety.
          </>
        }
      />

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          {[
            advisors.find(a => a.featured === '1'),
            advisors.find(a => a.featured === '2'),
          ]
            .filter((a): a is NonNullable<typeof a> => a != null)
            .map(advisor => (
              <FeaturedCard
                key={advisor.id}
                href={advisor.url !== '#' ? advisor.url : undefined}
                tagline={advisor.featuredTagline!}
                name={advisor.name}
                description={advisor.description}
                logo={advisor.logo ?? undefined}
                metadata={[
                  { label: 'Focus', value: advisor.focus },
                  { label: 'Status', value: advisor.status },
                ]}
                trackingPage="Advisors"
              />
            ))}
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://youtu.be/OpufM6yK4Go"
            target="_blank"
            rel="noopener noreferrer"
            className="block padding-bottom-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              Career advice video <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Video overview of career paths in AI safety
            </p>
          </a>
          <Link href="/events-and-training" className="block hover-opacity-80">
            <h3 className="padding-bottom-16px">
              Events &amp; training{' '}
              <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              AI safety events and training programs, both online and in-person
            </p>
          </Link>
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <AdvisorsClient advisors={advisors} />
    </div>
  )
}
