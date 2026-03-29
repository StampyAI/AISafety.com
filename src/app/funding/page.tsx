import { fetchLastUpdated } from '@/lib/data/last-updated'
import FeaturedCard from '@/components/FeaturedCard'
import FundingClient from './FundingClient'
import { getFunders } from '@/lib/data/funding'

export const metadata = {
  title: 'Funding – AISafety.com',
  description:
    'Organizations offering financial support to organizations and individuals working on AI safety.',
}

export default async function FundingPage() {
  const [funders, lastUpdated] = await Promise.all([
    getFunders(),
    fetchLastUpdated('funding'),
  ])

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Funding</h1>
      {lastUpdated.formattedDate && (
        <p className="paragraph-small color-teal-300 margin-bottom-40px">
          Last updated: {lastUpdated.formattedDate}
        </p>
      )}
      <h2 className="width-7-col margin-bottom-56px">
        These organizations offer{' '}
        <span className="color-light-teal">financial support</span> to
        organizations and individuals working on AI safety.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://coefficientgiving.org/apply-for-funding/"
            tagline="Largest funder in x-risk reduction"
            name="Coefficient Giving (CG)"
            description="Most funding is done via proactive research, but there are frequent requests for proposals in certain areas. Previously called Open Philanthropy."
            logo="/images/coefficient-giving.webp"
            metadata={[
              { label: 'Type', value: 'Fund' },
              { label: 'Accepting applications', value: 'Yes – rolling basis' },
            ]}
          />
          <FeaturedCard
            href="https://survivalandflourishing.fund/"
            tagline="Best for mid- to large-scale projects"
            name="Survival and Flourishing Fund (SFF)"
            description="Funds organizations working on humanity's long-term survival and flourishing. Speculation Grants are rolling; the full S-Process runs annually and is currently open."
            logo="/images/sff-white.svg"
            metadata={[
              { label: 'Type', value: 'Fund' },
              {
                label: 'Accepting applications',
                value: 'Yes – closes 22 April 2026',
              },
            ]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://www.lesswrong.com/posts/WGpFFJo2uFe5ssgEb/an-overview-of-the-ai-safety-funding-situation"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              An overview of the funding situation{' '}
              <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              An analysis of the main funding sources in AI safety over time,
              last updated early 2025
            </p>
          </a>
          <a
            href="https://aisafetyfunding.substack.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block padding-top-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              Funding newsletter <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Receive a regular email summarizing all new funding opportunities
              in AI safety
            </p>
          </a>
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <FundingClient funders={funders} />
    </div>
  )
}
