import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import FeaturedCard from '@/components/FeaturedCard'
import SelfStudyClient from './SelfStudyClient'
import { getCourses } from '@/lib/data/self-study'
import { displayCategory } from '@/lib/data/self-study-labels'

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

  const featuredCourses = [
    courses.find(c => c.featured === '1'),
    courses.find(c => c.featured === '2'),
  ].filter((c): c is NonNullable<typeof c> => c != null)

  return (
    <div className="container-default">
      <PageHeader
        title="Self-study"
        lastUpdatedIso={lastUpdated.lastUpdated}
        description={
          <>
            These curricula and reading lists enable you to{' '}
            <span className="color-teal-bright-300">
              dive deeper into AI safety{' '}
            </span>
            through independent learning.
          </>
        }
      />

      {/* Featured Cards */}
      <div className="featured-grid padding-bottom-80px">
        {featuredCourses.map((course, i) => (
          <FeaturedCard
            key={course.id}
            href={course.url !== '#' ? course.url : undefined}
            tagline={course.featuredTagline!}
            name={course.name}
            description={course.description}
            logo={course.image ?? undefined}
            titleMeta={
              course.organizer
                ? [
                    {
                      icon: '/images/author.svg',
                      value: `By ${course.organizer}`,
                    },
                  ]
                : undefined
            }
            meta={[
              ...(course.category
                ? [{ icon: '/images/category.svg', value: course.category }]
                : []),
              ...(course.courseType
                ? [{ icon: '/images/type.svg', value: course.courseType }]
                : []),
            ]}
            trackingPage="Self-study"
            index={i}
            count={featuredCourses.length}
          />
        ))}
      </div>

      {/* Main Content with Search, Cards, and Filters */}
      <SelfStudyClient courses={courses} />
    </div>
  )
}
