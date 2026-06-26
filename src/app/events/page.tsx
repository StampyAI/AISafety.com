import Link from 'next/link'
import { fetchLastUpdated } from '@/lib/data/last-updated'
import PageHeader from '@/components/PageHeader'
import { getEvents } from '@/lib/data/events'
import EventsClient from './EventsClient'
import styles from './page.module.css'

export default async function EventsPage() {
  const [events, lastUpdated] = await Promise.all([
    getEvents(),
    fetchLastUpdated('events'),
  ])

  return (
    <div className="container-default">
      <div className={`${styles.heroRow} padding-bottom-128px`}>
        <div className={styles.heroHeader}>
          <PageHeader
            title="Events"
            lastUpdatedIso={lastUpdated.lastUpdated}
            description={
              <>
                Find{' '}
                <span className="color-teal-bright-300">
                  conferences, competitions, meetups, talks, and workshops
                </span>{' '}
                in AI safety, both online and in person.
              </>
            }
          />
          <Link href="/training" className="paragraph-small color-teal-300">
            For fellowships, bootcamps, and courses go to{' '}
            <span className="color-white">Training</span> &rarr;
          </Link>
        </div>

        <div className={styles.newsletterSlot} aria-hidden="true">
          <p className="paragraph-xs color-teal-300">Newsletter signup</p>
        </div>
      </div>

      <EventsClient events={events} />
    </div>
  )
}
