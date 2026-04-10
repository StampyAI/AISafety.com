import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCard'
import CommunitiesClient from './CommunitiesClient'
import CommunitiesMap from './CommunitiesMap'
import styles from './page.module.css'
import { getCommunities } from '@/lib/data/communities'

export const metadata = {
  title: 'Communities – AISafety.com',
  description:
    'Groups dedicated to discussing and contributing to AI safety, both online and in-person.',
  openGraph: {
    title: 'Communities – AISafety.com',
    description:
      'Groups dedicated to discussing and contributing to AI safety, both online and in-person.',
    images: [{ url: '/images/link-preview.png' }],
  },
}

// Featured communities data (hardcoded as these are special highlights)
const featuredCommunities = [
  {
    id: 'ai-alignment-slack',
    name: 'AI Alignment Slack',
    tagline: 'Largest real-time online community',
    description:
      'Community of thousands involved in making AI safe. Includes channels dedicated to making introductions, finding study buddies, asking questions, and discovering opportunities.',
    logo: '/images/ai-alignment-slack.png',
    platform: 'Slack',
    activityLevel: 'Very active',
    focus: 'Main focus is AI safety',
    joinLink:
      'https://join.slack.com/t/ai-alignment/shared_invite/zt-3oytsoq2q-nzMwWJqs5fl4H~VXA6FQTA',
  },
  {
    id: 'lesswrong',
    name: 'LessWrong',
    tagline: 'Main forum for research and advocacy',
    description:
      'Forum dedicated to improving human reasoning and decision-making, and the primary online hub for long-form AI safety discussion and research.',
    logo: '/images/lesswrong.png',
    platform: 'Forum',
    activityLevel: 'Very active',
    focus: 'Partial focus on AI safety',
    joinLink: 'https://www.lesswrong.com/w/ai',
  },
]

export default async function CommunitiesPage() {
  const [communities, lastUpdated] = await Promise.all([
    getCommunities(),
    fetchLastUpdated('communities'),
  ])

  return (
    <div>
      <div className={styles.mapWrapper}>
        <CommunitiesMap communities={communities} />
        <h2 className={`${styles.mapTitleOverlay} shadow-text`}>
          In-person AI safety communities
        </h2>
      </div>
      <div className="container-default">
        <PageHeader
          title="Communities"
          lastUpdated={lastUpdated.formattedDate}
          id="communities"
          topPadding="padding-top-40px"
          description={
            <>
              There are many groups dedicated to discussing and contributing to
              AI safety, both{' '}
              <span className="color-light-teal">online and in-person.</span> We
              recommend joining a few.
            </>
          }
        />

        {/* Featured Communities + Related Resources */}
        <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
          <div className="flex flex-col-mobile gap-40px">
            {featuredCommunities.map(community => (
              <FeaturedCard
                key={community.id}
                href={community.joinLink}
                tagline={community.tagline}
                name={community.name}
                description={community.description}
                logo={community.logo}
                metadata={[
                  { label: 'Platform', value: community.platform },
                  { label: 'Activity level', value: community.activityLevel },
                  { label: 'Focus', value: community.focus },
                ]}
                trackingPage="Communities"
              />
            ))}
          </div>

          <aside className="hide-mobile">
            <p className="paragraph-small-bold padding-bottom-32px">
              Related resources
            </p>
            <Link
              href="https://www.lesswrong.com/community"
              target="_blank"
              rel="noopener noreferrer"
              className="block padding-bottom-40px hover-opacity-80"
            >
              <h3 className="padding-bottom-16px">
                Map of LessWrong groups{' '}
                <span className="color-teal-400">→</span>
              </h3>
              <p className="paragraph-small color-teal-300">
                People in Rationalist groups like these often overlap with those
                in AI safety
              </p>
            </Link>
            <Link
              href="https://forum.effectivealtruism.org/groups"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover-opacity-80"
            >
              <h3 className="padding-bottom-16px">
                Map of EA groups <span className="color-teal-400">→</span>
              </h3>
              <p className="paragraph-small color-teal-300">
                Effective Altruism groups also tend to be concerned with AI
                safety
              </p>
            </Link>
          </aside>
        </div>

        {/* Main Content with Search, Cards, and Filters */}
        <CommunitiesClient communities={communities} />
      </div>
    </div>
  )
}
