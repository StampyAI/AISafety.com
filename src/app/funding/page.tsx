import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCardLegacy'
import FundingClient from './FundingClient'
import { getFunders } from '@/lib/data/funding'

export const metadata = {
  title: 'Funding – AISafety.com',
  description:
    'Organizations offering financial support to organizations and individuals working on AI safety.',
  alternates: { canonical: '/funding' },
}

export default async function FundingPage() {
  const [funders, lastUpdated] = await Promise.all([
    getFunders(),
    fetchLastUpdated('funding'),
  ])

  return (
    <div className="container-default">
      <PageHeader
        title="Funding"
        lastUpdatedIso={lastUpdated.lastUpdated}
        description={
          <>
            These organizations offer{' '}
            <span className="color-light-teal">financial support</span> to
            organizations and individuals working on AI safety.
          </>
        }
      />

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          {[
            funders.find(f => f.featured === '1'),
            funders.find(f => f.featured === '2'),
          ]
            .filter((f): f is NonNullable<typeof f> => f != null)
            .map(funder => (
              <FeaturedCard
                key={funder.id}
                href={funder.url !== '#' ? funder.url : undefined}
                tagline={funder.featuredTagline!}
                name={funder.name}
                description={funder.description}
                logo={funder.logo ?? undefined}
                metadata={[
                  { label: 'Type', value: funder.type },
                  {
                    label: 'Accepting applications',
                    value: funder.acceptingApplications,
                  },
                ]}
                trackingPage="Funding"
                trackingId={funder.id}
                trackingPosition={`F${funder.featured}`}
              />
            ))}
        </div>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <FundingClient funders={funders} />
    </div>
  )
}
