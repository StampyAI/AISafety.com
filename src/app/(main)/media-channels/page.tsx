import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import MediaChannelsClient from './MediaChannelsClient'
import { MediaChannel } from '../../api/media-channels/route'

export const metadata = {
  title: 'Media Channels – AISafety.com',
  description:
    'Information sources to help you learn more about AI safety and stay up to date.',
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblCTOMzyH3vILL5I'

interface AirtableRecord {
  id: string
  fields: {
    Name?: string
    Description?: string
    Image?: Array<{ url: string }>
    Type?: string | string[]
    Link?: string
  }
}

async function getMediaChannels(): Promise<MediaChannel[]> {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    console.error('Airtable credentials not configured')
    return []
  }

  try {
    const allRecords: MediaChannel[] = []
    let offset: string | null = null

    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
      url.searchParams.set('filterByFormula', '{Publish?} = TRUE()')
      url.searchParams.set('sort[0][field]', 'Sort')
      url.searchParams.set('sort[0][direction]', 'asc')
      if (offset) {
        url.searchParams.set('offset', offset)
      }

      let response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
        next: { revalidate: 300 },
      })

      if (!response.ok) {
        await new Promise(r => setTimeout(r, 1000))
        response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
          next: { revalidate: 300 },
        })
      }

      if (!response.ok) {
        console.warn('Airtable API error:', response.status)
        return []
      }

      const data = await response.json()

      for (const record of data.records as AirtableRecord[]) {
        const fields = record.fields
        if (!fields.Name) continue

        let logo: string | null = null
        if (fields.Image && fields.Image.length > 0) {
          logo = fields.Image[0].url
        }

        allRecords.push({
          id: record.id,
          name: fields.Name,
          description: fields.Description || '',
          logo,
          type: Array.isArray(fields.Type)
            ? fields.Type.join(', ')
            : fields.Type || '',
          url: fields.Link || '#',
          lastModified: null,
        })
      }

      offset = data.offset || null
    } while (offset)

    return allRecords
  } catch (error) {
    console.error('Error fetching media channels:', error)
    return []
  }
}

export default async function MediaChannelsPage() {
  const channels = await getMediaChannels()

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Media channels</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/media-channels"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        <span className="color-light-teal">
          The AI safety space is changing rapidly.
        </span>{' '}
        These information sources can help you learn more and stay up to date.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://www.transformernews.ai/"
            tagline="Top newsletter recommendation"
            name="Transformer"
            description="Aims to help decision-makers understand what's happening in AI and why it matters, through news roundups, explainers, features, and opinion pieces."
            logo="/images/1-21-min.png"
            metadata={[{ label: 'Type', value: 'Newsletter' }]}
          />
          <FeaturedCard
            href="https://www.youtube.com/playlist?list=PLWQikawCP4UFM_ziLf9X2rcOLCSbqisRE"
            tagline="Top recommended videos"
            name="AI Safety Playlist"
            description="A carefully curated and regularly updated YouTube playlist to help people gain an understanding of what's going on with AI."
            logo="/images/YouTube.png"
            metadata={[{ label: 'Type', value: 'YouTube' }]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://aisafetyfeed.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block padding-bottom-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              AI Safety Feed <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Web app curating content from various sources
            </p>
          </a>
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
