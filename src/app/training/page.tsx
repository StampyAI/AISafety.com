import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import NewsletterSignup from '@/components/NewsletterSignup'
import { getTrainingPrograms, getRecurringPrograms } from '@/lib/data/training'
import TrainingClient from './TrainingClient'
import styles from './page.module.css'

export default async function TrainingPage() {
  const [programs, recurring, lastUpdated] = await Promise.all([
    getTrainingPrograms(),
    getRecurringPrograms(),
    fetchLastUpdated('training'),
  ])

  return (
    <div className="container-default">
      <div className={`${styles.heroRow} padding-bottom-56px`}>
        <div className={styles.heroHeader}>
          <PageHeader
            title="Training programs"
            lastUpdatedIso={lastUpdated.lastUpdated}
            description={
              <>
                Find{' '}
                <span className="color-teal-bright-300">
                  fellowships, bootcamps, and courses
                </span>{' '}
                in AI safety to upskill and build career capital. Both online
                and in person.
              </>
            }
          />
          <Link href="/events" className="paragraph-small color-teal-300">
            For conferences, talks, workshops, and more go to{' '}
            <span className="color-white">Events</span> &rarr;
          </Link>
        </div>

        <div className={styles.newsletterSlot}>
          <NewsletterSignup />
        </div>
      </div>

      <TrainingClient programs={programs} recurring={recurring} />
    </div>
  )
}
