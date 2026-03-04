import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import FundingClient from './FundingClient'
import { Funder } from '../../api/funding/route'

export const metadata = {
  title: 'Funding – AISafety.com',
  description:
    'Organizations offering financial support to organizations and individuals working on AI safety.',
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblzMTLDZWZKqTxrq'

interface AirtableRecord {
  id: string
  fields: {
    Name?: string
    Description?: string
    Logo?: Array<{ url: string }>
    Type?: string | string[]
    'Recipient type'?: string | string[]
    'Accepting applications?'?: string | string[]
    Website?: string
  }
}

async function getFunders(): Promise<Funder[]> {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    console.error('Airtable credentials not configured')
    return []
  }

  try {
    const allRecords: Funder[] = []
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
        if (fields.Logo && fields.Logo.length > 0) {
          logo = fields.Logo[0].url
        }

        allRecords.push({
          id: record.id,
          name: fields.Name,
          description: fields.Description || '',
          logo,
          type: Array.isArray(fields.Type)
            ? fields.Type.join(', ')
            : fields.Type || '',
          recipientType: Array.isArray(fields['Recipient type'])
            ? fields['Recipient type'].join(', ')
            : fields['Recipient type'] || '',
          acceptingApplications: Array.isArray(
            fields['Accepting applications?']
          )
            ? fields['Accepting applications?'].join(', ')
            : fields['Accepting applications?'] || '',
          url: fields.Website || '#',
          lastModified: null,
        })
      }

      offset = data.offset || null
    } while (offset)

    return allRecords
  } catch (error) {
    console.error('Error fetching funders:', error)
    return []
  }
}

export default async function FundingPage() {
  const funders = await getFunders()

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Funding</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/funding"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
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
            name="Coefficient Giving"
            description="Most funding is done via proactive research, but there are frequent requests for proposals in certain areas. Previously called Open Philanthropy."
            logo="/images/CG-LOGO.webp"
            metadata={[
              { label: 'Type', value: 'Fund' },
              { label: 'Accepting applications', value: 'Yes' },
            ]}
          />
          <FeaturedCard
            href="https://survivalandflourishing.fund/"
            tagline="Best for mid- to large-scale projects"
            name="Survival and Flourishing Fund"
            description="Provides financial support to organizations working to improve humanity's long-term prospects for survival and flourishing."
            logo="/images/sff-white.svg"
            metadata={[
              { label: 'Type', value: 'Fund' },
              { label: 'Accepting applications', value: 'Yes' },
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
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <FundingClient funders={funders} />
    </div>
  )
}
