import Image from 'next/image'
import Link from 'next/link'
import RelativeDate from '@/components/RelativeDate'
import TrackedLink from '@/components/TrackedLink'
import { fetchAllLastUpdated } from '@/lib/data/last-updated'
import styles from './page.module.css'

export default async function Home() {
  const dates = await fetchAllLastUpdated()

  return (
    <div className="container-default">
      <div className="flex flex-col-mobile items-start gap-40px padding-top-56px padding-bottom-80px">
        <h1 className="width-8-col">
          Find your place in the AI safety ecosystem
        </h1>
        <div className="width-4-col">
          <p className="padding-bottom-32px">
            Curated lists of events, communities, courses, and more – focused on
            preventing human extinction from AI.
          </p>
          <div className={styles.attribution}>
            <Image
              width={80}
              height={32}
              loading="lazy"
              alt="Community thumbnails"
              src="/images/team-thumbnails.png"
              className="margin-bottom-12px"
            />
            <p className="paragraph-xs">
              Maintained by{' '}
              <a href="/about" className="underline">
                AI safety community-builders
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className={`${styles['card-full-width-1']} margin-bottom-40px`}>
        <div>
          <p className="paragraph-small-bold shadow-text padding-bottom-12px">
            Attend an event or training program
          </p>
          <h2 className="shadow-text padding-bottom-40px">
            Events and programs to build skills, meet others, and explore
            opportunities in AI safety – online and in person
          </h2>
          <Link
            href="/events-and-training"
            className="button-primary drop-shadow"
          >
            View all events and programs
          </Link>
          {dates.events && (
            <RelativeDate
              iso={dates.events}
              className={`${styles.date} paragraph-xs shadow-text`}
            />
          )}
        </div>
        <div className={styles['card-full-width-1-right-card']}>
          <Image
            loading="lazy"
            src="/images/bookmark-light.svg"
            alt=""
            className={styles.bookmark}
            width={24}
            height={32}
          />
          <h3 className="shadow-text padding-bottom-8px">
            EA Global: New York City 2026
          </h3>
          <p className="paragraph-small-bold shadow-text padding-bottom-16px">
            {/* Location omitted – obvious from event name. Format: "DATE – CITY, COUNTRY" */}
            16–18 October 2026
          </p>
          <p className="padding-bottom-40px">
            3-day conference with talks, workshops, and networking on AI safety
            and other effective altruism cause areas.
          </p>
          <TrackedLink
            href="https://www.effectivealtruism.org/ea-global/events/ea-global-new-york-city-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary"
            trackingPage="Home"
            trackingName="EA Global: New York City 2026"
          >
            Learn more
          </TrackedLink>
        </div>
      </div>

      <div className={`${styles['card-full-width-2']} margin-bottom-40px`}>
        <div
          className={`${styles['card-full-width-2-left-card']} backdrop-blur-md`}
        >
          <p className="paragraph-small-bold shadow-text padding-bottom-12px">
            Explore the ecosystem
          </p>
          <h2 className="shadow-text padding-bottom-40px">
            A visual overview of the key organizations, programs, and projects
            in AI safety
          </h2>
          <Link href="/map" className="button-primary drop-shadow-light">
            View map
          </Link>
          {dates.map && (
            <RelativeDate
              iso={dates.map}
              className={`${styles.date} paragraph-xs shadow-text opacity-80`}
            />
          )}
        </div>
      </div>

      <div className={`${styles['card-full-width-3']} margin-bottom-40px`}>
        <div>
          <p className="paragraph-small-bold padding-bottom-12px">
            Join a community
          </p>
          <h2 className="padding-bottom-40px">
            Groups dedicated to discussing and contributing to AI safety, both
            online and in-person
          </h2>
          <Link
            href="/communities"
            className="button-primary drop-shadow-light"
          >
            View all communities
          </Link>
          {dates.communities && (
            <RelativeDate
              iso={dates.communities}
              className={`${styles.date} paragraph-xs`}
            />
          )}
        </div>
        <div className={styles['card-full-width-3-right-card-light']}>
          <Image
            loading="lazy"
            src="/images/bookmark-dark.svg"
            alt=""
            className={styles.bookmark}
            width={24}
            height={32}
          />
          <p className="paragraph-small-bold padding-bottom-12px">
            Largest real-time community
          </p>
          <div className={`${styles['icon-row']} padding-bottom-24px`}>
            <Image
              loading="lazy"
              src="/images/ai-alignment-slack.png"
              alt=""
              className={styles['icon-homepage']}
              width={56}
              height={56}
            />
            <h3>AI Alignment Slack</h3>
          </div>
          <p className="padding-bottom-32px">
            Join thousands of AI safety folks ready to answer questions, share
            opportunities, and connect.
          </p>
          <TrackedLink
            href="https://join.slack.com/t/ai-alignment/shared_invite/zt-3oytsoq2q-nzMwWJqs5fl4H~VXA6FQTA"
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary"
            trackingPage="Home"
            trackingName="AI Alignment Slack"
          >
            Join
          </TrackedLink>
        </div>
      </div>

      <div className={`${styles['cards-grid-2-col']} margin-bottom-40px`}>
        <div className={styles['card-half-width-1']}>
          <div className={styles['card-half-width-main-text']}>
            <p className="paragraph-small-bold padding-bottom-12px shadow-text">
              Learn
            </p>
            <h2 className="width-4-col padding-bottom-40px shadow-text">
              Self-study courses and curated study guides to deepen your
              expertise
            </h2>
            <Link href="/self-study" className="button-primary drop-shadow">
              View all self-study options
            </Link>
            {dates['self-study'] && (
              <RelativeDate
                iso={dates['self-study']}
                className={`${styles['date-alt']} paragraph-xs`}
              />
            )}
          </div>
          <div
            className={`${styles['card-half-width-bottom-card']} backdrop-blur-md`}
          >
            <Image
              loading="lazy"
              src="/images/bookmark-light.svg"
              alt=""
              className={styles.bookmark}
              width={24}
              height={32}
            />
            <p className="paragraph-small-bold padding-bottom-12px">
              Standard intro course
            </p>
            <div className={`${styles['icon-row']} padding-bottom-24px`}>
              <Image
                loading="lazy"
                src="/images/blue-dot-impact.svg"
                alt=""
                width={56}
                height={56}
              />
              <h3>Blue Dot Impact: Technical &amp; Governance</h3>
            </div>
            <p className="padding-bottom-24px">
              Learn key concepts and research perspectives in AI safety, split
              into two tracks.
            </p>
            <div className="block">
              <TrackedLink
                href="https://bluedot.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary"
                trackingPage="Home"
                trackingName="Blue Dot Impact: Technical & Governance"
              >
                View curricula
              </TrackedLink>
            </div>
          </div>
        </div>

        <div className={styles['card-half-width-2']}>
          {dates.jobs && (
            <RelativeDate
              iso={dates.jobs}
              className={`${styles['date-alt']} paragraph-xs opacity-80`}
            />
          )}
          <p className="paragraph-small-bold padding-bottom-12px opacity-80">
            Find a job
          </p>
          <h2 className="width-4-col padding-bottom-40px">
            Open positions in research, policy, operations, and more
          </h2>
          <Link href="/jobs" className="button-primary drop-shadow">
            View all jobs
          </Link>
          {dates.jobs && (
            <RelativeDate
              iso={dates.jobs}
              className={`${styles['date-alt']} paragraph-xs opacity-80`}
            />
          )}
        </div>

        <div className={styles['card-half-width-3']}>
          <div className={styles['card-half-width-main-text']}>
            <p className="paragraph-small-bold padding-bottom-12px opacity-80">
              Stay informed
            </p>
            <h2 className="width-4-col padding-bottom-40px">
              Podcasts, newsletters, and more to keep you up to date in AI
              safety
            </h2>
            <Link href="/media-channels" className="button-primary drop-shadow">
              View all media channels
            </Link>
            {dates['media-channels'] && (
              <RelativeDate
                iso={dates['media-channels']}
                className={`${styles['date-alt']} paragraph-xs opacity-80`}
              />
            )}
          </div>
        </div>

        <div className={styles['card-half-width-4']}>
          <div className={styles['card-half-width-main-text']}>
            <p className="paragraph-small-bold padding-bottom-12px">
              Get funding
            </p>
            <h2 className="width-4-col padding-bottom-40px">
              Organizations offering financial support to AI safety projects
            </h2>
            <Link href="/funding" className="button-primary drop-shadow-light">
              View all funders
            </Link>
            {dates.funding && (
              <RelativeDate
                iso={dates.funding}
                className={`${styles['date-alt']} paragraph-xs`}
              />
            )}
          </div>
          <div className={styles['card-half-width-bottom-card-light']}>
            <Image
              loading="lazy"
              src="/images/bookmark-dark.svg"
              alt=""
              className={styles.bookmark}
              width={24}
              height={32}
            />
            <p className="paragraph-small-bold padding-bottom-12px">
              Best for medium to large projects
            </p>
            <div className={`${styles['icon-row']} padding-bottom-24px`}>
              <Image
                loading="lazy"
                src="/images/sff.png"
                alt=""
                className={styles['icon-homepage']}
                width={56}
                height={56}
              />
              <h3>Survival and Flourishing Fund</h3>
            </div>
            <p className="padding-bottom-24px">
              Funds orgs working to improve humanity&apos;s long-term prospects
              for survival and flourishing.
            </p>
            <TrackedLink
              href="https://survivalandflourishing.fund/"
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary"
              trackingPage="Home"
              trackingName="Survival and Flourishing Fund"
            >
              Learn more
            </TrackedLink>
          </div>
        </div>
      </div>

      <div className={`${styles['cards-grid-3-col']} padding-bottom-104px`}>
        <div className={styles['card-third-width-1']}>
          <div className={styles['card-half-width-main-text']}>
            <p className="paragraph-small-bold padding-bottom-8px shadow-text">
              Speak to an advisor
            </p>
            <h3 className="padding-bottom-32px shadow-text">
              Free 1-1 calls to help you contribute most effectively to AI
              safety
            </h3>
            <Link href="/advisors" className="button-primary drop-shadow">
              View all advisors
            </Link>
            {dates.advisors && (
              <RelativeDate
                iso={dates.advisors}
                className={`${styles['date-alt']} paragraph-xs shadow-text`}
              />
            )}
          </div>
        </div>

        <div className={styles['card-third-width-2']}>
          <div className={styles['card-half-width-main-text']}>
            <p className="paragraph-small-bold padding-bottom-8px">
              Volunteer projects
            </p>
            <h3 className="padding-bottom-32px">
              Build online tools to support the AI safety ecosystem
            </h3>
            <Link href="/projects" className="button-primary drop-shadow">
              View all projects
            </Link>
            {dates.projects && (
              <RelativeDate
                iso={dates.projects}
                className={`${styles['date-alt']} paragraph-xs`}
              />
            )}
          </div>
          <div className={styles['card-third-width-bottom-card']}>
            <Image
              loading="lazy"
              src="/images/bookmark-dark-small.svg"
              alt=""
              className={styles.bookmark}
              width={24}
              height={32}
            />
            <p className="paragraph-small-bold padding-bottom-12px">
              Featured project
            </p>
            <div className={`${styles['icon-row']} padding-bottom-24px`}>
              <h3>AI Safety Feed</h3>
            </div>
            <div className="block">
              <TrackedLink
                href="https://aisafetyfeed.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary"
                trackingPage="Home"
                trackingName="AI Safety Feed"
              >
                Learn more
              </TrackedLink>
            </div>
          </div>
        </div>

        <div className={styles['card-third-width-3']}>
          <div className={styles['card-half-width-main-text']}>
            <p className="paragraph-small-bold padding-bottom-8px opacity-80">
              Donate
            </p>
            <h3 className="padding-bottom-32px">
              How to donate effectively to the AI safety field
            </h3>
            <Link href="/donation-guide" className="button-primary drop-shadow">
              View guide
            </Link>
            {dates['donation-guide'] && (
              <RelativeDate
                iso={dates['donation-guide']}
                className={`${styles['date-alt']} paragraph-xs opacity-80`}
              />
            )}
          </div>
        </div>
      </div>

      <div className={styles['aisafety-info']}>
        <div className="width-6-col">
          <p className="color-teal paragraph-small-bold padding-bottom-12px">
            Visit AISafety.info
          </p>
          <h2 className="shadow-text">
            Learn what AI safety is, why it matters, and what you can do to help
          </h2>
        </div>
        <TrackedLink
          href="https://aisafety.info/"
          target="_blank"
          rel="noopener noreferrer"
          className="button-primary"
          trackingPage="Home"
          trackingName="AISafety.info"
        >
          <span>AISafety.info</span>
          <Image
            loading="lazy"
            src="/images/arrow-up-right.svg"
            alt=""
            width={16}
            height={16}
          />
        </TrackedLink>
      </div>
    </div>
  )
}
