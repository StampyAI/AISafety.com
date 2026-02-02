import Link from 'next/link'
import Image from 'next/image'
import UpButton from './UpButton'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className="margin-top-192px">
      <div className="container-default">
        <div className="flex gap-56px padding-bottom-80px">
          {/* First footer column */}
          <div className="width-6-col">
            <div className="width-4-col">
              <Image
                src="/images/logo.svg"
                alt="AI Safety logo"
                width={144.14}
                height={24}
                className="margin-bottom-24px"
              />
              <p className="paragraph-small padding-bottom-32px">
                We&apos;re a global team of volunteers and professionals from
                various disciplines who believe AI poses a grave risk of
                extinction to humanity.
              </p>
              <Link href="/about" className="button-secondary">
                Learn more about us
              </Link>
            </div>
          </div>

          {/* Second footer column */}
          <div className="width-3-col">
            <h4 className="paragraph-small-bold padding-bottom-24px">
              Help us out
            </h4>
            <div className="color-teal-400 paragraph-small flex flex-col gap-8px">
              <Link
                href="https://airtable.com/appF8XfZUGXtfi40E/pagndDvdya1DSqoxN/form"
                target="_blank"
                rel="noopener noreferrer"
              >
                Suggest a correction
              </Link>
              <Link href="/feedback">Give anonymous feedback</Link>
              <Link
                href="https://www.every.org/alignment-ecosystem-development"
                target="_blank"
                rel="noopener noreferrer"
              >
                Donate
              </Link>
            </div>
          </div>

          {/* Third footer column */}
          <div className="width-3-col">
            <h4 className="paragraph-small-bold padding-bottom-24px">
              Newsletters
            </h4>
            <div className="color-teal-400 paragraph-small flex flex-col gap-8px">
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
                AI Safety Funding (coming soon)
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

        <div className="flex justify-between items-center margin-bottom-24px">
          <div className="flex items-center gap-8px">
            <Image
              width={80}
              height={32}
              alt="Community thumbnails"
              src="/images/thumbnails.png"
            />
            <p className="paragraph-xs">
              Maintained by AI safety community-builders
            </p>
          </div>
          <p className="paragraph-xs color-teal-400">
            (ɔ) 2025 · This site is released under a CC BY-SA license
          </p>
        </div>
      </div>

      <UpButton />
    </footer>
  )
}
