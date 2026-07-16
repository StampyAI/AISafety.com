import Link from 'next/link'
import Image from 'next/image'
import UpButton from './UpButton'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className="margin-top-192px padding-bottom-24px">
      <div className="container-default">
        <div className="flex flex-col-mobile gap-56px margin-bottom-128px">
          {/* First footer column */}
          <div className="width-6-col">
            <div className="width-4-col">
              <Image
                src="/images/logo.svg"
                alt="AI Safety logo"
                width={139}
                height={24}
                className="margin-bottom-24px"
              />
              <p className="paragraph-small padding-bottom-32px">
                We&apos;re a small nonprofit driven by 1.25 salaried employees
                and lots of volunteers. We aim to multiply global AI safety
                efforts through a centralized, comprehensive, and up-to-date
                resource hub.
              </p>
              <Link href="/about" className="button-secondary">
                Learn more about us
              </Link>
            </div>
          </div>

          {/* Second footer column */}
          <div className="width-3-col">
            <h4 className="paragraph-small-bold padding-bottom-16px">
              Help us out
            </h4>
            <div
              className={`paragraph-small flex flex-col gap-8px opacity-80 ${styles.links}`}
            >
              <Link
                href="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
                target="_blank"
                rel="noopener noreferrer"
              >
                Suggest a correction
              </Link>
              <Link
                href="https://airtable.com/appF8XfZUGXtfi40E/pageXZp18w3Sqm1Z7/form"
                target="_blank"
                rel="noopener noreferrer"
              >
                Give anonymous feedback
              </Link>
              <Link
                href="https://www.every.org/alignment-ecosystem-development#/donate/card"
                target="_blank"
                rel="noopener noreferrer"
              >
                Donate
              </Link>
            </div>
          </div>

          {/* Third footer column */}
          <div className="width-3-col">
            <h4 className="paragraph-small-bold padding-bottom-16px">
              Newsletters
            </h4>
            <div
              className={`paragraph-small flex flex-col gap-8px opacity-80 ${styles.links}`}
            >
              <Link
                href="https://aisafetyeventsandtraining.substack.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                AI Safety Events &amp; Training
              </Link>
              <Link
                href="https://aisafetyfunding.substack.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                AI Safety Funding
              </Link>
              <Link
                href="https://aisafetycom.substack.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                AISafety.com Updates
              </Link>
            </div>
          </div>
        </div>
        <div className="divider margin-bottom-24px"></div>

        <div className="flex justify-between items-center flex-col-mobile gap-16px">
          <div className="flex items-center gap-8px">
            <Image
              width={80}
              height={32}
              alt="Community thumbnails"
              src="/images/team-thumbnails.png"
            />
            <p className="paragraph-xs">
              Maintained by AI safety community-builders
            </p>
          </div>
          <p className={`paragraph-xs opacity-80 ${styles.links}`}>
            (ɔ) 2026 · This site is released under a CC BY-SA license ·{' '}
            <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      </div>

      <UpButton />
    </footer>
  )
}
