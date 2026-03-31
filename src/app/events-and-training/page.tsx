import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import EventsEmbeds from './EventsEmbeds'
import styles from './page.module.css'

export const metadata = {
  title: 'Events & Training – AISafety.com',
  description:
    'AI safety events and training programs, both online and in-person.',
}

export default async function EventsAndTrainingPage() {
  const lastUpdated = await fetchLastUpdated('events')

  return (
    <div>
      {/* Preconnect to Airtable so embeds load faster */}
      <link rel="preconnect" href="https://airtable.com" />
      <link rel="dns-prefetch" href="https://airtable.com" />
      {/* Main Content */}
      <div className="container-default">
        <h1 className="padding-top-56px padding-bottom-8px">
          Events &amp; training
        </h1>

        {lastUpdated.formattedDate && (
          <p className="paragraph-small color-teal-300 margin-bottom-40px">
            Last updated: {lastUpdated.formattedDate}
          </p>
        )}

        <h2 className="width-7-col margin-bottom-56px">
          There&apos;s a wide range of events and training programs in AI
          safety, both online and in-person. These can help you{' '}
          <span className="color-light-teal">
            build skills, make connections, and discover opportunities.
          </span>
        </h2>

        <div className={styles['action-links-grid']}>
          <Link
            href="https://aisafetyeventsandtraining.substack.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles['action-link']}
          >
            <p className="paragraph-default-bold padding-bottom-16px">
              Subscribe to newsletter{' '}
              <span className="color-teal-400">&rarr;</span>
            </p>
            <p className={styles['action-description']}>
              Receive a weekly email summarizing all new events and training
              programs
            </p>
          </Link>

          <Link
            href="https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles['action-link']} hide-mobile`}
          >
            <p className="paragraph-default-bold padding-bottom-16px">
              Suggest entry <span className="color-teal-400">&rarr;</span>
            </p>
            <p className={styles['action-description']}>
              Suggest an event or training program to be listed here and in the
              newsletter
            </p>
          </Link>

          <Link
            href="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles['action-link']} hide-mobile`}
          >
            <p className="paragraph-default-bold padding-bottom-16px">
              Suggest correction <span className="color-teal-400">&rarr;</span>
            </p>
            <p className={styles['action-description']}>
              Let us know of any updates that should be made to the database
            </p>
          </Link>
        </div>

        <h2 className="padding-bottom-24px">
          All upcoming events and training programs
        </h2>
      </div>

      {/* Airtable Embeds – load on view, then sequentially in background */}
      <EventsEmbeds />

      {/* Link to self-study */}
      <div className="container-default">
        <Link href="/self-study">
          <h3 className="padding-bottom-8px">
            Self-study courses <span className="color-teal-400">→</span>
          </h3>
          <p className={styles['self-study-description']}>
            Courses with freely available materials for independent learning
          </p>
        </Link>
      </div>
    </div>
  )
}
