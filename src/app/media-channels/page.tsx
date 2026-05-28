import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCard'
import MediaChannelsClient from './MediaChannelsClient'
import { getMediaChannels } from '@/lib/data/media-channels'

export const metadata = {
  title: 'Media Channels – AISafety.com',
  description:
    'Information sources to help you learn more about AI safety and stay up to date.',
  alternates: { canonical: '/media-channels' },
}

export default async function MediaChannelsPage() {
  const [channels, lastUpdated] = await Promise.all([
    getMediaChannels(),
    fetchLastUpdated('media-channels'),
  ])

  return (
    <div className="container-default">
      <PageHeader
        title="Media channels"
        lastUpdated={lastUpdated.formattedDate}
        description={
          <>
            <span className="color-light-teal">
              The AI safety space is changing rapidly.
            </span>{' '}
            These information sources can help you learn more and stay up to
            date.
          </>
        }
      />

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          {[
            channels.find(c => c.featured === '1'),
            channels.find(c => c.featured === '2'),
          ]
            .filter((c): c is NonNullable<typeof c> => c != null)
            .map(channel => (
              <FeaturedCard
                key={channel.id}
                href={channel.url !== '#' ? channel.url : undefined}
                tagline={channel.featuredTagline!}
                name={channel.name}
                description={channel.description}
                logo={channel.logo ?? undefined}
                metadata={[{ label: 'Type', value: channel.type }]}
                trackingPage="Media channels"
              />
            ))}
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resource
          </p>
          <a
            href="https://aisafety.info"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              AISafety.info <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              A comprehensive FAQ on various AI safety topics, written and
              curated by our team and affiliates
            </p>
          </a>
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <MediaChannelsClient channels={channels} />
    </div>
  )
}
