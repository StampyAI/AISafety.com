import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCard'
import SelfStudyClient from './SelfStudyClient'
import { getCourses } from '@/lib/data/self-study'

export const metadata = {
  title: 'Self-study – AISafety.com',
  description:
    'Curricula and reading lists to dive deeper into AI safety through independent learning.',
  alternates: { canonical: '/self-study' },
}

export default async function SelfStudyPage() {
  const [courses, lastUpdated] = await Promise.all([
    getCourses(),
    fetchLastUpdated('self-study'),
  ])

  return (
    <div className="container-default">
      <PageHeader
        title="Self-study"
        lastUpdated={lastUpdated.formattedDate}
        description={
          <>
            These curricula and reading lists enable you to{' '}
            <span className="color-light-teal">
              dive deeper into AI safety{' '}
            </span>
            through independent learning.
          </>
        }
      />

      {/* Featured Cards + Related Resources */}
      <div className="flex flex-col-mobile gap-56px padding-bottom-80px">
        <div className="flex flex-col-mobile gap-40px">
          {[
            courses.find(c => c.featured === '1'),
            courses.find(c => c.featured === '2'),
          ]
            .filter((c): c is NonNullable<typeof c> => c != null)
            .map(course => (
              <FeaturedCard
                key={course.id}
                href={course.url !== '#' ? course.url : undefined}
                tagline={course.featuredTagline!}
                name={course.name}
                description={course.description}
                logo={course.image ?? undefined}
                metadata={[
                  { label: 'Focus', value: course.category },
                  { label: 'Created by', value: course.organizer },
                ]}
                trackingPage="Self-study"
                trackingPosition={`F${course.featured}`}
              />
            ))}
        </div>

        <aside className="hide-mobile">
          <p className="paragraph-small-bold padding-bottom-32px">
            Related resources
          </p>
          <Link
            href="/events-and-training"
            className="block padding-bottom-40px hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              Events &amp; training{' '}
              <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Upcoming fellowships, conferences, facilitated courses etc.
            </p>
          </Link>
          <a
            href="https://theaidigest.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover-opacity-80"
          >
            <h3 className="padding-bottom-16px">
              AI Digest <span className="color-teal-400">&rarr;</span>
            </h3>
            <p className="paragraph-small color-teal-300">
              Interactive explainers of AI capabilities and trends
            </p>
          </a>
        </aside>
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <SelfStudyClient courses={courses} />
    </div>
  )
}
