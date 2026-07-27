import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCardLegacy'
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
                trackingId={advisor.id}
                trackingPosition={`F${advisor.featured}`}
              />
            ))}
        </div>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <AdvisorsClient advisors={advisors} />
    </div>
  )
}
