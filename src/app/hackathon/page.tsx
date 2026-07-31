import ApplicationForm from './ApplicationForm'
import styles from './page.module.css'

export const metadata = {
  title: 'Hackathon 2026 – AISafety.com',
  description:
    'Join the AISafety.com team at CEEALAR in Blackpool, England, 17–20 September 2026, for a four-day hackathon to improve the site. Free to attend – applications close 14 August.',
  alternates: { canonical: '/hackathon' },
}

export default function HackathonPage() {
  return (
    <div className="container-default">
      <div className={styles.layout}>
        <div>
          <h1 className="padding-top-56px padding-bottom-24px">
            AISafety.com Hackathon 2026
          </h1>

          <h2 className="padding-bottom-40px">
            A four-day, in-person hackathon to{' '}
            <span className="color-light-teal">
              improve the AI safety resource hub
            </span>
            .
          </h2>

          <p className="padding-bottom-16px">
            <strong>When</strong>
            <br />
            Thursday 17th September – Sunday 20th September 2026
          </p>
          <p className="padding-bottom-16px">
            <strong>Where</strong>
            <br />
            <a
              href="https://www.ceealar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              CEEALAR
            </a>{' '}
            (the EA Hotel) in Blackpool, England
          </p>
          <p className="padding-bottom-16px">
            <strong>Cost</strong>
            <br />
            Free, including accommodation and all meals
          </p>
          <p className="padding-bottom-40px">
            <strong>Applications close</strong>
            <br />
            14 August 2026
          </p>

          <p className="color-teal-300 padding-bottom-40px">
            Once a year, the core AISafety.com team gets together with a group
            of amazing volunteers and spends an extended weekend getting a bunch
            of stuff done to improve the hub for AI safety resources. Outside
            work sessions, we do some relaxed fun activities like going for
            walks, board games, and movie nights.
          </p>
          <h3 className="padding-bottom-16px">Who we&apos;re looking for</h3>
          <ul
            className={`color-teal-300 padding-bottom-40px ${styles.bullets}`}
          >
            <li>
              <strong>Product managers and designers</strong>
              <ul>
                <li>
                  To execute the vision for some new projects, build out design
                  mockups, conduct user research, offer consulting, and/or
                  brainstorm product solutions
                </li>
              </ul>
            </li>
            <li>
              <strong>Project managers</strong>
              <ul>
                <li>
                  To lead and organize project efforts and/or lead sprints
                </li>
              </ul>
            </li>
            <li>
              <strong>Developers</strong>
              <ul>
                <li>
                  To work with product managers, designers, and Claude Code to
                  bring some amazing new things to life
                </li>
              </ul>
            </li>
            <li>
              <strong>
                Connectors, influential people, and subject-matter experts
              </strong>
              <ul>
                <li>
                  To help us with targeted community outreach, general community
                  outreach, social media, and/or to give takes to product
                  managers and designers
                </li>
              </ul>
            </li>
            <li>
              <strong>Promotion people</strong>
              <ul>
                <li>
                  To help us with targeted community outreach, general community
                  outreach, social media, and/or SEO
                </li>
              </ul>
            </li>
            <li>
              <strong>Anything else</strong>
              <ul>
                <li>Just tell us how you can help!</li>
              </ul>
            </li>
          </ul>

          <p className="color-teal-300 padding-bottom-40px">
            On the first evening of the hackathon, we will divide team members
            into 3–4 small teams by{' '}
            <a
              href="https://app.notion.com/p/15aaef8c3f9640018d6b256d39b4ee8a?pvs=21"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              project
            </a>
            . Members will get to decide which projects they work on and what
            they bring to each project. We&apos;re also open to new project
            suggestions.
          </p>

          <h3 className="padding-bottom-16px">Why it&apos;s worth it!</h3>
          <ul
            className={`color-teal-300 padding-bottom-40px ${styles.bullets}`}
          >
            <li>
              <strong>
                Build your resume, career capital, and make connections
              </strong>{' '}
              (everyone at the EA hotel, beyond just our hackathon, is working
              on something high-impact, mostly AI safety)
            </li>
            <li>
              <strong>Help save the world</strong>
            </li>
            <li>
              <strong>Have fun</strong> beyond just the work! We set aside two
              sessions a day for beach walks, games, music, and more.
            </li>
            <li>
              <strong>Food and room</strong> covered. Most likely each person
              will have their own room, but if the hotel happens to be very full
              some people may need to share.
            </li>
          </ul>

          <h3 className="padding-bottom-16px">The venue</h3>
          <p className="color-teal-300 padding-bottom-16px">
            We&apos;ll be hosted at{' '}
            <a
              href="https://www.ceealar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              CEEALAR
            </a>{' '}
            (AKA the EA Hotel), a place worth experiencing in its own right.
          </p>
          <p className="color-teal-300 padding-bottom-40px">
            If you have any questions please message Bryce on the{' '}
            <a
              href="https://discord.gg/WQG8FAGqun"
              target="_blank"
              rel="noopener noreferrer"
              className="color-light-teal"
            >
              AISafety.com Discord server
            </a>{' '}
            at @bryceerobertson or email{' '}
            <a
              href="mailto:bryceerobertson@gmail.com"
              className="color-light-teal"
            >
              bryceerobertson@gmail.com
            </a>
            .
          </p>
        </div>

        <div className={styles.sticky}>
          <ApplicationForm />
        </div>
      </div>
    </div>
  )
}
