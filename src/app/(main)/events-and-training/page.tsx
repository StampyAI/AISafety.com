import Link from 'next/link'
import LastUpdated from '@/components/LastUpdated'
import styles from './page.module.css'

export const metadata = {
  title: 'Events & Training – AISafety.com',
  description:
    'AI safety events and training programs, both online and in-person.',
}

export default function EventsAndTrainingPage() {
  return (
    <div>
      {/* Main Content */}
      <div className="container-default">
        <h1 className="padding-top-56px padding-bottom-8px">
          Events &amp; training
        </h1>

        <LastUpdated
          apiEndpoint="/api/last-updated/events"
          className="paragraph-small color-teal-300 margin-bottom-40px"
        />

        <h2 className="width-7-col margin-bottom-56px">
          There&apos;s a wide range of events and training programs in AI
          safety, both online and in-person. These can help you{' '}
          <span className="color-light-teal">
            build skills, make connections, and discover opportunities.
          </span>
        </h2>

        {/* Action Links */}
        <div className={styles['action-links-grid']}>
          <Link
            href="https://aisafetyeventsandtraining.substack.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles['action-link']}
          >
            <h3 className={styles['action-title']}>
              Subscribe to newsletter →
            </h3>
            <p className={styles['action-description']}>
              Receive a weekly email summarizing all new events and training
              programs
            </p>
          </Link>

          <Link
            href="https://airtable.com/appF8XfZUGXtfi40E/pagyqtPZ2BFcKU6ys/form"
            target="_blank"
            rel="noopener noreferrer"
            className="action-link hide-mobile"
          >
            <h3 className={styles['action-title']}>Suggest entry →</h3>
            <p className={styles['action-description']}>
              Suggest an event or training program to be listed here and in the
              newsletter
            </p>
          </Link>

          <Link
            href="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            target="_blank"
            rel="noopener noreferrer"
            className="action-link hide-mobile"
          >
            <h3 className={styles['action-title']}>Suggest correction →</h3>
            <p className={styles['action-description']}>
              Let us know of any updates that should be made to the database
            </p>
          </Link>
        </div>

        <h2 className="padding-bottom-24px">
          All upcoming events and training programs
        </h2>
      </div>

      {/* Airtable Embeds */}
      <div className={styles['airtable-section']}>
        <iframe
          src="https://airtable.com/embed/appF8XfZUGXtfi40E/shrLgl03tMK4q6cyc?viewControls=on"
          frameBorder={0}
          width="100%"
          height="2300"
          style={{ background: 'transparent', border: '1px solid #ccc' }}
          className={styles['airtable-embed']}
        />

        <iframe
          src="https://airtable.com/embed/appF8XfZUGXtfi40E/shrZ4Uh9OsbUryfjp"
          frameBorder={0}
          width="100%"
          height="2880"
          style={{ background: 'transparent', border: '1px solid #ccc' }}
          className={`${styles['airtable-embed']} hide-mobile`}
        />
      </div>

      {/* Second section */}
      <div className="container-default">
        <h2 className="hide-mobile">Open for application/registration</h2>
      </div>

      <div className={styles['airtable-section']}>
        <iframe
          src="https://airtable.com/embed/appF8XfZUGXtfi40E/shrbap2hy8Yd3xojA"
          frameBorder={0}
          width="100%"
          height="1000"
          style={{ background: 'transparent', border: '1px solid #ccc' }}
          className={`${styles['airtable-embed']} hide-mobile`}
        />
      </div>

      {/* Link to self-study */}
      <div className="container-default">
        <Link href="/self-study">
          <h3 className={styles['self-study-heading']}>
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
