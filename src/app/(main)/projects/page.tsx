import LastUpdated from '@/components/LastUpdated'
import FeaturedCard from '@/components/FeaturedCard'
import ProjectsClient from './ProjectsClient'
import { Project } from '../../api/projects/route'

export const metadata = {
  title: 'Volunteer Projects – AISafety.com',
  description:
    'Initiatives seeking your volunteer help, focused on supporting and improving the AI safety field.',
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_ID = 'tblHT29QNgMYKB8iW'

interface AirtableRecord {
  id: string
  fields: {
    'Project Name'?: string
    'Description (short)'?: string
    Status?: string | string[]
    Website?: string
    'Contact name'?: string
  }
}

async function getProjects(): Promise<Project[]> {
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    console.error('Airtable credentials not configured')
    return []
  }

  try {
    const allRecords: Project[] = []
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
        if (!fields['Project Name']) continue

        allRecords.push({
          id: record.id,
          name: fields['Project Name'],
          description: fields['Description (short)'] || '',
          logo: null,
          contact: fields['Contact name'] || '',
          status: Array.isArray(fields.Status)
            ? fields.Status.join(', ')
            : fields.Status || '',
          url: fields.Website || '#',
          lastModified: null,
        })
      }

      offset = data.offset || null
    } while (offset)

    return allRecords
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="container-default">
      <h1 className="padding-top-56px padding-bottom-8px">
        Volunteer projects
      </h1>
      <LastUpdated
        apiEndpoint="/api/last-updated/projects"
        className="paragraph-small color-teal-300 margin-bottom-40px"
      />
      <h2 className="width-7-col margin-bottom-56px">
        Initiatives{' '}
        <span className="color-light-teal">seeking your volunteer help</span>.
        These projects are focused on supporting and improving the AI safety
        field.
      </h2>

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          <FeaturedCard
            href="https://huggingface.co/datasets/StampyAI/alignment-research-dataset"
            tagline="Seeking maintainer"
            name="Alignment Research Dataset"
            description='Regularly scrapes all major sources of alignment data for use by the AI Safety Chatbot and other projects. Currently needs someone to maintain it. Search "alignment research dataset" on Hugging Face for details.'
            metadata={[
              { label: 'Contact', value: 'Olivier Coutu' },
              { label: 'Status', value: 'Active' },
            ]}
          />
          <FeaturedCard
            href="https://aisafetyfeed.com/"
            tagline="Content curation platform"
            name="AI Safety Feed"
            description="A curated stream for AI safety content, gathering posts and research from key sources. AI helps summarize, tag, and rate content for novelty, letting users quickly find what's important and relevant to them."
            metadata={[
              { label: 'Contact', value: 'Matt Brooks' },
              { label: 'Status', value: 'Active' },
            ]}
          />
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <a
            href="https://discord.com/invite/BfwQq2FTqE"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              AED Discord <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              A hub connecting AI safety volunteers and projects
            </p>
          </a>
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <ProjectsClient projects={projects} />
    </div>
  )
}
