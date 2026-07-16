import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCard'
import ProjectsClient from './ProjectsClient'
import { getProjects } from '@/lib/data/projects'

export const metadata = {
  title: 'Volunteer Projects – AISafety.com',
  description:
    'Initiatives seeking your volunteer help, focused on supporting and improving the AI safety field.',
  alternates: { canonical: '/projects' },
}

export default async function ProjectsPage() {
  const [projects, lastUpdated] = await Promise.all([
    getProjects(),
    fetchLastUpdated('projects'),
  ])

  return (
    <div className="container-default">
      <PageHeader
        title="Volunteer projects"
        lastUpdated={lastUpdated.formattedDate}
        description={
          <>
            Initiatives{' '}
            <span className="color-light-teal">
              seeking your volunteer help
            </span>
            . These projects are focused on supporting and improving the AI
            safety field.
          </>
        }
      />

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          {[
            projects.find(p => p.featured === '1'),
            projects.find(p => p.featured === '2'),
          ]
            .filter((p): p is NonNullable<typeof p> => p != null)
            .map(project => (
              <FeaturedCard
                key={project.id}
                tagline={project.featuredTagline!}
                name={project.name}
                description={project.description}
                metadata={[
                  ...(project.contact || project.email
                    ? [
                        {
                          label: 'Contact',
                          value: [project.contact, project.email].filter(
                            Boolean
                          ) as string[],
                        },
                      ]
                    : []),
                  { label: 'Status', value: project.status },
                ]}
                trackingPage="Projects"
                trackingPosition={`F${project.featured}`}
              />
            ))}
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
              Alignment Ecosystem Development (AED) Discord{' '}
              <span className="color-teal-400">&rarr;</span>
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
