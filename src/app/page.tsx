import Image from 'next/image'
import Link from 'next/link'
import LastUpdated from '@/components/LastUpdated'

export default function Home() {
  return (
    <div className="content-container">
      <div className="w-layout-grid flex padding-top-56px padding-80px">
        <h1 className="width-8-col">
          Find your place in the AI safety ecosystem
        </h1>
        <div className="width-4-col">
          <p className="padding-32px">
            Curated lists of events, communities, courses, and more – focused on
            preventing human extinction from AI.
          </p>
          <Image
            width={80}
            height={32}
            loading="lazy"
            alt="Community thumbnails"
            src="/images/thumbnails.png"
            className="padding-12px"
          />
          <p className="paragraph-xs">
            Maintained by AI safety community-builders
          </p>
        </div>
      </div>

      <div className="card-full-width margin-40px">
        <div>
          <p className="paragraph-small-bold shadow-text padding-12px">
            Attend an event or training program
          </p>
          <h2 className="shadow-text padding-40px">
            Events and programs to build skills, meet others, and explore
            opportunities in AI safety – online and in person
          </h2>
          <Link
            href="/events-and-training"
            className="button-primary drop-shadow"
          >
            View all events and programs
          </Link>
          <LastUpdated
            apiEndpoint="/api/last-updated/events"
            className="date paragraph-xs shadow-text"
            format="relative"
          />
        </div>
        <div className="card_full_width-right_card backdrop-blur-md">
          <Image
            loading="lazy"
            src="/images/bookmark-light.svg"
            alt=""
            className="bookmark"
            width={24}
            height={24}
          />
          <h3 className="shadow-text padding-8px">EAGxAmsterdam 2025</h3>
          <p className="paragraph-small-bold shadow-text padding-16px">
            12–14 Dec 2025
          </p>
          <p className="padding-40px">
            A high‑signal weekend to explore clear paths to AI safety impact and
            meet researchers, funders, and organizations.
          </p>
          <a
            href="https://www.effectivealtruism.org/ea-global/events/eagxamsterdam"
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary"
          >
            Learn more
          </a>
        </div>
      </div>

      <div className="card-full-width-2 margin-40px">
        <div className="card-full-width-2-left-card backdrop-blur-md">
          <p className="paragraph-small-bold shadow-text padding-12px">
            Explore the ecosystem
          </p>
          <h2 className="shadow-text padding-40px">
            A visual overview of the key organizations, programs, and projects
            in AI safety
          </h2>
          <Link href="/map" className="button-primary drop-shadow-light">
            View map
          </Link>
          <p
            className="date paragraph-xs shadow-text opacity-80"
            data-source-page="/map"
          >
            Updated 5 days ago
          </p>
        </div>
      </div>

      <div className="card-full-width-3 margin-40px">
        <div>
          <p className="paragraph-small-bold padding-12px">Join a community</p>
          <h2 className="padding-40px">
            Groups dedicated to discussing and contributing to AI safety, both
            online and in-person
          </h2>
          <Link
            href="/communities"
            className="button-primary drop-shadow-light"
          >
            View all communities
          </Link>
          <p className="date paragraph-xs" data-source-page="/communities">
            Updated 3 days ago
          </p>
        </div>
        <div className="card-full-width-right-card-light">
          <Image
            loading="lazy"
            src="/images/bookmark-dark.svg"
            alt=""
            className="bookmark"
            width={24}
            height={24}
          />
          <p className="paragraph-small-bold padding-12px">
            Largest real-time community
          </p>
          <div className="flex-gap-8px padding-24px">
            <Image
              loading="lazy"
              src="/images/1-1-2.png"
              alt=""
              className="icon-homepage"
              width={56}
              height={56}
            />
            <h3>AI Alignment Slack</h3>
          </div>
          <p className="padding-32px">
            Join thousands of AI safety folks ready to answer questions, share
            opportunities, and connect.
          </p>
          <a
            href="https://join.slack.com/t/ai-alignment/shared_invite/zt-3jqiicbfr-u1lLvDWy6E5WL7uucV~opw"
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary"
          >
            Join
          </a>
        </div>
      </div>

      <div className="cards-grid margin-40px mb-10">
        <div className="card-half-width-1">
          <div className="card-half-width-main-text">
            <p className="paragraph-small-bold padding-12px shadow-text">
              Learn
            </p>
            <h2 className="padding-40px shadow-text">
              Self-study courses and curated study guides to deepen your
              expertise
            </h2>
            <Link href="/self-study" className="button-primary drop-shadow">
              View all self-study options
            </Link>
            <p className="date-alt paragraph-xs" data-source-page="/self-study">
              Updated 2 days ago
            </p>
          </div>
          <div className="card-half-width_bottom-card backdrop-blur-md">
            <Image
              loading="lazy"
              src="/images/bookmark-light.svg"
              alt=""
              className="bookmark"
              width={24}
              height={24}
            />
            <p className="paragraph-small-bold padding-12px">
              Standard intro course
            </p>
            <div className="flex-gap-8px padding-24px">
              <Image
                loading="lazy"
                src="/images/download-2-1.svg"
                alt=""
                width={56}
                height={56}
              />
              <h3>Blue Dot Impact: Technical &amp; Governance</h3>
            </div>
            <p className="padding-24px">
              Learn key concepts and research perspectives in AI safety, split
              into two tracks.
            </p>
            <div className="display-block">
              <a
                href="https://bluedot.org/courses"
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary"
              >
                View curricula
              </a>
            </div>
          </div>
        </div>

        <div className="card-half-width-2">
          <div className="card-half-width-main-text">
            <p className="paragraph-small-bold padding-12px opacity-80">
              Find a job
            </p>
            <h2 className="padding-40px">
              Open positions in research, policy, operations, and more
            </h2>
            <Link href="/jobs" className="button-primary drop-shadow">
              View all jobs
            </Link>
            <p
              className="date-alt paragraph-xs opacity-80"
              data-source-page="/jobs"
            >
              Updated 1 day ago
            </p>
          </div>
        </div>

        <div className="card-half-width-3">
          <div className="card-half-width-main-text">
            <p className="paragraph-small-bold padding-12px opacity-80">
              Stay informed
            </p>
            <h2 className="padding-40px">
              Podcasts, newsletters, and more to keep you up to date in AI
              safety
            </h2>
            <Link href="/media-channels" className="button-primary drop-shadow">
              View all media channels
            </Link>
            <p
              className="date-alt paragraph-xs opacity-80"
              data-source-page="/media-channels"
            >
              Updated 6 days ago
            </p>
          </div>
        </div>

        <div className="card-half-width-4">
          <div className="card-half-width-main-text">
            <p className="paragraph-small-bold padding-12px">Get funding</p>
            <h2 className="padding-40px">
              Organizations offering financial support to AI safety projects
            </h2>
            <Link href="/funding" className="button-primary drop-shadow-light">
              View all funders
            </Link>
            <p className="date-alt paragraph-xs" data-source-page="/funders">
              Updated 3 days ago
            </p>
          </div>
          <div className="card-half-width_bottom-card-light">
            <Image
              loading="lazy"
              src="/images/bookmark-dark.svg"
              alt=""
              className="bookmark"
              width={24}
              height={24}
            />
            <p className="paragraph-small-bold padding-12px">
              Best for medium to large projects
            </p>
            <div className="flex-horizontal_center flex-gap-8px padding-24px">
              <Image
                loading="lazy"
                src="/images/1-22-1.png"
                alt=""
                className="icon-homepage"
                width={32}
                height={32}
              />
              <h3>Survival and Flourishing Fund</h3>
            </div>
            <p className="padding-24px">
              Funds orgs working to improve humanity&apos;s long-term prospects
              for survival and flourishing.
            </p>
            <a
              href="https://survivalandflourishing.fund/"
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary"
            >
              Learn more
            </a>
          </div>
        </div>
      </div>

      <div className="cards-grid padding-104px">
        <div className="card-third-width-1">
          <div className="card-half-width-main-text">
            <p className="paragraph-small-bold padding-8px-3 shadow-text">
              Speak to an advisor
            </p>
            <h3 className="padding-32px shadow-text">
              Free 1-1 calls to help you contribute most effectively to AI
              safety
            </h3>
            <Link href="/advisors" className="button-primary drop-shadow">
              View all advisors
            </Link>
            <p
              className="date-alt paragraph-xs shadow-text"
              data-source-page="/advisors"
            >
              Updated 4 days ago
            </p>
          </div>
        </div>

        <div className="card-third-width-2">
          <div className="card-half-width-main-text">
            <p className="paragraph-small-bold padding-8px-3">
              Volunteer projects
            </p>
            <h3 className="padding-32px">
              Build online tools to support the AI safety ecosystem
            </h3>
            <Link href="/projects" className="button-primary drop-shadow">
              View all projects
            </Link>
            <p className="date-alt paragraph-xs" data-source-page="/projects">
              Updated 2 days ago
            </p>
          </div>
          <div className="card-third-width-bottom-card">
            <Image
              loading="lazy"
              src="/images/bookmark-dark-small.svg"
              alt=""
              className="bookmark"
              width={16}
              height={16}
            />
            <p className="paragraph-small-bold padding-12px">
              Featured project
            </p>
            <div className="flex-gap-8px padding-24px">
              <h3>AI Safety Feed</h3>
            </div>
            <div className="display-block">
              <a
                href="https://aisafetyfeed.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary"
              >
                Learn more
              </a>
            </div>
          </div>
        </div>

        <div className="card-third-width-3">
          <div className="card-half-width-main-text">
            <p className="paragraph-small-bold padding-8px-3 opacity-80">
              Donate
            </p>
            <h3 className="padding-32px">
              How to donate effectively to the AI safety field
            </h3>
            <Link href="/donation-guide" className="button-primary drop-shadow">
              View guide
            </Link>
            <p
              className="date-alt paragraph-xs opacity-80"
              data-source-page="/donation-guide"
            >
              Updated 1 week ago
            </p>
          </div>
        </div>
      </div>

      <div className="aisafety-info">
        <div>
          <p className="color-teal paragraph-small-bold padding-12px">
            Visit AISafety.info
          </p>
          <h2 className="shadow-text">
            Learn what AI safety is, why it matters, and what you can do to help
          </h2>
        </div>
        <a
          href="https://aisafety.info/"
          target="_blank"
          rel="noopener noreferrer"
          className="button-primary w-inline-block"
        >
          <p className="paragraph-12">AISafety.info</p>
          <Image
            loading="lazy"
            src="/images/arrow-up-right.svg"
            alt=""
            width={16}
            height={16}
          />
        </a>
      </div>
    </div>
  )
}
