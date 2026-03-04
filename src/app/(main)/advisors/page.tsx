import Link from 'next/link'
import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import AdvisorsClient from './AdvisorsClient'
import { Advisor } from '../../api/advisors/route'

export const metadata = {
  title: 'Advisors – AISafety.com',
  description:
    'Advisors offering free guidance calls to help you most effectively contribute to AI safety.',
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblf3KKYnmgcjVGhD'

interface AirtableRecord {
  id: string
  fields: {
    Name?: string
    Description?: string
    Logo?: Array<{ url: string }>
    Focus?: string | string[]
    Status?: string | string[]
    Link?: string
  }
}

async function getAdvisors(): Promise<Advisor[]> {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    console.error('Airtable credentials not configured')
    return []
  }

  try {
    const allRecords: Advisor[] = []
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
          focus: Array.isArray(fields.Focus)
            ? fields.Focus.join(', ')
            : fields.Focus || '',
          status: Array.isArray(fields.Status)
            ? fields.Status.join(', ')
            : fields.Status || '',
          url: fields.Link || '#',
          lastModified: null,
        })
      }

      offset = data.offset || null
    } while (offset)

    return allRecords
  } catch (error) {
    console.error('Error fetching advisors:', error)
    return []
  }
}

export default async function AdvisorsPage() {
  const advisors = await getAdvisors()

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">Advisors</h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/advisors"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
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
            href="https://80000hours.org/speak-with-us/?int_campaign=aisafety.com"
            tagline="Experienced EA career advisors"
            name="80,000 Hours"
            description="Career advice by a well-connected and professional organization dedicated to helping people use their career for good. Does not accept all applications."
            logo="/images/80000_Hours_logo2.png"
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
            logo="/images/dc409ec6a6a8a2083408f6dffc3f80c2.png"
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
              Upcoming fellowships, conferences, facilitated courses etc.
            </p>
          </Link>
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <AdvisorsClient advisors={advisors} />
    </div>
  )
}
