import Image from 'next/image'
import styles from './ContributeButtons.module.css'

interface ExtraLink {
  label: string
  url: string
  /** Path to a 12×12 teal-bright-300 svg in /images. Defaults to the star. */
  icon?: string
}

interface ContributeButtonsProps {
  suggestEntryUrl: string
  suggestCorrectionUrl: string
  noun: string
  /** Airtable grid/view URL for the "View data in Airtable" card. */
  airtableUrl?: string
  /** Extra line under "View data in Airtable", e.g. "(includes past events)". */
  airtableNote?: string
  /** Extra contribute actions beyond add + suggest correction. */
  extraLinks?: ExtraLink[]
}

// "a" vs "an" for the "Add a …" label.
function article(noun: string) {
  return /^[aeiou]/i.test(noun) ? 'an' : 'a'
}

function ActionRow({
  href,
  icon,
  label,
}: {
  href: string
  icon: string
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-8px color-teal-bright-300 hover-white ${styles.row}`}
    >
      <span className={`bg-teal-bright-850 ${styles.badge}`}>
        <Image src={icon} alt="" width={12} height={12} unoptimized />
      </span>
      <span className="paragraph-xs">{label}</span>
    </a>
  )
}

export default function ContributeButtons({
  suggestEntryUrl,
  suggestCorrectionUrl,
  noun,
  airtableUrl = '#',
  airtableNote,
  extraLinks,
}: ContributeButtonsProps) {
  return (
    <div className="flex flex-col gap-16px">
      {/* Contribute card */}
      <div className={`border-only ${styles.card}`}>
        <p className="paragraph-xs color-teal-300 padding-bottom-16px">
          Contribute to this page
        </p>

        <div className="flex flex-col gap-8px">
          <ActionRow
            href={suggestEntryUrl}
            icon="/images/plus-small.svg"
            label={`Add ${article(noun)} ${noun}`}
          />
          <ActionRow
            href={suggestCorrectionUrl}
            icon="/images/pencil-small.svg"
            label="Suggest a correction"
          />
          {extraLinks?.map(link => (
            <ActionRow
              key={link.url}
              href={link.url}
              icon={link.icon || '/images/star-small.svg'}
              label={link.label}
            />
          ))}
        </div>
      </div>

      {/* View data in Airtable card */}
      <a
        href={airtableUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`border-only border-hover color-teal-300 hover-white ${styles.airtableCard}`}
      >
        <Image
          src="/images/airtable-vector.svg"
          alt=""
          width={220}
          height={86}
          unoptimized
          className={styles.airtableImg}
        />
        <span className={`${styles.badge} ${styles.airtableArrow}`}>
          <Image
            src="/images/icons/arrow-up-right-figma.svg"
            alt=""
            width={28}
            height={28}
            unoptimized
          />
        </span>
        <div className={styles.airtableTextWrap}>
          <p className="paragraph-xs padding-left-16px padding-bottom-12px">
            View data in Airtable
            {airtableNote && (
              <>
                <br />
                {airtableNote}
              </>
            )}
          </p>
        </div>
      </a>
    </div>
  )
}
