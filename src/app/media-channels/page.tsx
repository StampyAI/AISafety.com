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
          <FeaturedCard
            href="https://thezvi.substack.com/"
            tagline="Top blog recommendation"
            name="Don't Worry About the Vase"
            description="Blog by Zvi Mowshowitz on various topics, including AI, offering detailed analysis and personal insights from a rationalist perspective. Posts very often."
            logo="/images/zvi.webp"
            metadata={[{ label: 'Type', value: 'Blog' }]}
            trackingPage="Media channels"
          />
          <FeaturedCard
            href="https://www.youtube.com/playlist?list=PLWQikawCP4UFM_ziLf9X2rcOLCSbqisRE"
            tagline="Top recommended videos"
            name="AI Safety Playlist"
            description="A carefully curated and regularly updated YouTube playlist to help people gain an understanding of what's going on with AI."
            logo="/images/YouTube.png"
            metadata={[{ label: 'Type', value: 'YouTube' }]}
            trackingPage="Media channels"
          />
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
