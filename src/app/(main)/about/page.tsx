import Image from 'next/image'
import styles from './page.module.css'

export const metadata = {
  title: 'About – AISafety.com',
  description:
    'We aim to provide a central and comprehensive hub for AI safety, through which individuals can easily discover the most impactful resources for them.',
}

export default function AboutPage() {
  return (
    <div className="container-narrow">
      <h1 className="padding-top-56px padding-bottom-40px">About us</h1>

      <h2 className="width-9-col-narrow padding-bottom-56px">
        We aim to provide a{' '}
        <span className="color-light-teal">central and comprehensive hub</span>{' '}
        for AI safety, through which individuals can easily discover the most
        impactful resources for them.
      </h2>

      <div className="flex gap-56px flex-col-mobile">
        {/* Left column — text sections */}
        <div className="width-7-col-narrow">
          <div>
            <h3 className="padding-bottom-16px">Funding</h3>
            <p className="color-teal-300 padding-bottom-40px">
              We are operating on $100k of funding from the Survival and
              Flourishing Fund (SFF), a grantmaker that funds lorem ipsum dolor
              sit amet kind of projects. This pays for 1 full-time, and 1
              part-time salary (everyone else is volunteer) plus some
              miscellaneous costs, like website hosting.
            </p>

            <h3 className="padding-bottom-16px">
              Financial motivations (or lack thereof)
            </h3>
            <p className="color-teal-300">
              The two team members that receive compensation have never made a
              decision based on whether it would land us more funding, nor have
              we been influenced or pressured by SFF. We genuinely care about
              this topic, and making our decisions based on what most helps the
              world seems to be totally adequate for receiving our modest amount
              of funding.
            </p>
          </div>
        </div>

        {/* Right column — Questions card */}
        <div className={`${styles.questionsCard} width-5-col-narrow`}>
          <p className="color-white paragraph-default-bold">Questions?</p>
          <p className="color-teal-300 padding-top-16px paragraph-small">
            We&apos;re just a few &quot;normal&quot; people, and we really want
            to be transparent and accessible. Find our contact info below!
          </p>
          <a href="#team" className={styles.arrowCircle}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.05316 11.5468C4.8579 11.3515 4.54132 11.3515 4.34606 11.5468C4.15079 11.742 4.15079 12.0586 4.34606 12.2539L7.54186 15.4497C7.63265 15.5426 7.75937 15.6003 7.89956 15.6003C8.01138 15.6003 8.11462 15.5636 8.1979 15.5016C8.21734 15.4872 8.23582 15.4712 8.25316 15.4539L11.4532 12.2539C11.6484 12.0586 11.6484 11.742 11.4532 11.5468C11.2579 11.3515 10.9413 11.3515 10.7461 11.5468L8.39956 13.8933L8.39956 0.90039C8.39956 0.624248 8.1757 0.40039 7.89956 0.40039C7.62342 0.40039 7.39956 0.624248 7.39956 0.90039L7.39956 13.8932L5.05316 11.5468Z"
                fill="#094141"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Team section */}
      <h2
        id="team"
        className="padding-top-80px padding-bottom-56px width-7-col-narrow"
      >
        We are built and sustained on <em>lots</em> of volunteer effort, plus
        1.25 salaried employees.
      </h2>

      <div className="flex flex-col gap-56px">
        {/* Row 1 */}
        <div className="flex gap-56px flex-col-mobile">
          <div className="width-6-col-narrow">
            <div className="flex gap-16px items-center padding-bottom-24px">
              <Image
                src="/images/soeren.png"
                alt="Søren Elverlin"
                width={72}
                height={72}
              />
              <div>
                <p className="paragraph-default-bold padding-bottom-4px">
                  Søren Elverlin
                </p>
                <p className="paragraph-small color-teal-300">
                  Project lead, back-end development
                </p>
              </div>
            </div>
            <p className="paragraph-small color-teal-300 padding-bottom-16px">
              Søren got into AI Safety in 2016 by reading
              &quot;Superintelligence&quot; by Nick Bostrom. Lorem ipsum dolor
              sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua.
            </p>
            <a
              href="mailto:soeren@aisafety.com"
              className="color-teal paragraph-small"
            >
              soeren@aisafety.com
            </a>
            <div className="padding-top-16px">
              <a
                href="https://calendly.com/soeren-elverlin/30-minute-evening-meeting?utm_medium=website&utm_source=aisafetycom&utm_campaign=about"
                className="button-secondary"
              >
                Schedule a meeting
              </a>
            </div>
          </div>

          <div className="width-6-col-narrow">
            <div className="flex gap-16px items-center padding-bottom-24px">
              <Image
                src="/images/bryce.png"
                alt="Bryce Robertson"
                width={72}
                height={72}
              />
              <div>
                <p className="paragraph-default-bold padding-bottom-4px">
                  Bryce Robertson
                </p>
                <p className="paragraph-small color-teal-300">
                  Project manager
                </p>
              </div>
            </div>
            <p className="paragraph-small color-teal-300 padding-bottom-16px">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation.
            </p>
            <a
              href="mailto:bryce@aisafety.com"
              className="color-teal paragraph-small"
            >
              bryce@aisafety.com
            </a>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex gap-56px flex-col-mobile">
          <div className="width-6-col-narrow">
            <div className="flex gap-16px items-center padding-bottom-24px">
              <Image
                src="/images/melissa.png"
                alt="Melissa Samworth"
                width={72}
                height={72}
              />
              <div>
                <p className="paragraph-default-bold padding-bottom-4px">
                  Melissa Samworth
                </p>
                <p className="paragraph-small color-teal-300">
                  Product design, front-end development
                </p>
              </div>
            </div>
            <p className="paragraph-small color-teal-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation.
            </p>
          </div>

          <div className="width-6-col-narrow">
            <div className="flex gap-16px items-center padding-bottom-24px">
              <Image src="/images/plex.png" alt="Plex" width={72} height={72} />
              <div>
                <p className="paragraph-default-bold padding-bottom-4px">
                  Plex
                </p>
                <p className="paragraph-small color-teal-300">
                  Founder, advisor
                </p>
              </div>
            </div>
            <p className="paragraph-small color-teal-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation.
            </p>
          </div>
        </div>
      </div>

      {/* Volunteers & community section */}
      <div className="flex gap-56px padding-top-104px flex-col-mobile">
        <h2 className="width-4-col-narrow">
          30+ volunteers &amp; tons of takes from the community (thank you!)
        </h2>

        <div className="flex flex-col gap-56px width-4-col-narrow">
          <div>
            <div className={styles.iconCircle}>
              <Image src="/images/people.svg" alt="" width={16} height={16} />
            </div>
            <p className="paragraph-small color-teal-300 padding-top-24px padding-bottom-24px">
              Volunteers tend to contribute on a project-to-project basis,
              typically in the domains of development, design, and user
              research.
            </p>
            <a
              href="mailto:bryceerobertson@gmail.com?subject=Volunteering%20for%20AISafety.com"
              className="button-secondary"
            >
              Volunteer
            </a>
          </div>

          <div>
            <div className={styles.iconCircle}>
              <Image
                src="/images/speechBubble.svg"
                alt=""
                width={16}
                height={16}
              />
            </div>
            <p className="paragraph-small color-teal-300 padding-top-24px padding-bottom-24px">
              We do our best to structure our takes and decisions based on the
              wisdom of the community at large.
            </p>
            <a
              href="https://discord.gg/faamWzPcv8"
              className="button-secondary"
            >
              Give us your take
            </a>
          </div>
        </div>

        <div className="width-4-col-narrow">
          <div className={styles.iconCircle}>
            <Image src="/images/addDoc.svg" alt="" width={16} height={16} />
          </div>
          <p className="paragraph-small color-teal-300 padding-top-24px padding-bottom-24px">
            We consider AISafety.com a community project, and encourage
            community members to add listings that we may have missed.
          </p>
          <a
            href="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
            className="button-secondary"
          >
            Suggest a correction
          </a>
        </div>
      </div>
    </div>
  )
}
