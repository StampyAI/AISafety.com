import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import FeaturedCard from '@/components/FeaturedCard'
import AdvisorsClient from './AdvisorsClient'
import { getAdvisors } from '@/lib/data/advisors'

export const metadata = {
  title: 'Advisors – AISafety.com',
  description:
    'Advisors offering free guidance calls to help you most effectively contribute to AI safety.',
}

export default async function AdvisorsPage() {
  const [advisors, lastUpdated] = await Promise.all([
    getAdvisors(),
    fetchLastUpdated('advisors'),
  ])

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Advisors</h1>
      {lastUpdated.formattedDate && (
        <p className="paragraph-small color-teal-300 margin-bottom-40px">
          Last updated: {lastUpdated.formattedDate}
        </p>
      )}
      <h2 className="width-7-col margin-bottom-56px">
        <span className="color-light-teal">
          Connecting with human experts can be invaluable.
        </span>{' '}
        These advisors offer free guidance calls to help you most effectively
        contribute to AI safety.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://successif.org/"
            tagline="Career transition advice"
            name="Successif"
            description="Provides personalized career advising to experienced professionals seeking to transition into AI risk reduction roles, offering expert guidance and practical support."
            logo="/images/successif.webp"
            metadata={[
              { label: 'Focus', value: 'Career/contribution' },
              { label: 'Status', value: 'Active' },
            ]}
          />
          <FeaturedCard
            href="https://aisafety.quest/#calls"
            tagline="Impact-focused career advice"
            name="AI Safety Quest"
            description="Grassroots volunteer organization helping people contribute to reducing catastrophic risk from AI by directing them to the most relevant resources and communities."
            logo="/images/ai-safety-quest.png"
            metadata={[
              { label: 'Focus', value: 'Career/contribution' },
              { label: 'Status', value: 'Active' },
            ]}
          />
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
