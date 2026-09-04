import { previewPillsShown } from '@/lib/admin/auth'
import { isPreviewRequest } from '@/lib/preview'
import { formatTimeAgo } from '@/lib/format-date'
import adminStyles from '../admin.module.css'
import styles from './preview.module.css'
import PreviewToggle from './PreviewToggle'

// Never prerendered: the page shows this session's own switch-pill and
// preview state, which lives in cookies.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Every page whose content comes from Airtable. /donation-guide is left out —
// its content lives in the code, so there is nothing to preview.
const PAGES: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/training', label: 'Training' },
  { href: '/map', label: 'Field map' },
  { href: '/communities', label: 'Communities' },
  { href: '/self-study', label: 'Self-study' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/funding', label: 'Funding' },
  { href: '/media-channels', label: 'Media channels' },
  { href: '/advisors', label: 'Advisors' },
  { href: '/projects', label: 'Volunteer projects' },
  { href: '/founders', label: 'Founder toolkit' },
]

export default async function PreviewAdminPage() {
  const pillsShown = await previewPillsShown()
  const previewOn = await isPreviewRequest()
  const buildTime = process.env.BUILD_TIME
  const rebuilt = buildTime ? formatTimeAgo(buildTime, new Date()) : null

  return (
    <div className={adminStyles.editorColumn}>
      <div className={adminStyles.pageHeading}>
        <h1 className={adminStyles.pageTitle}>Site preview</h1>
        {rebuilt && (
          <p className={adminStyles.pageMeta}>
            Public version built{' '}
            <span className={adminStyles.pageMetaValue}>{rebuilt}</span>
          </p>
        )}
      </div>

      <div className={adminStyles.editorBlock}>
        <div className={adminStyles.editorBlockHeader}>
          <h2 className={adminStyles.editorBlockTitle}>
            Switch buttons are{' '}
            <span className={pillsShown ? styles.stateOn : styles.stateOff}>
              {pillsShown ? 'SHOWN' : 'HIDDEN'}
            </span>
            {previewOn && (
              <span className={styles.previewNote}> · preview mode is on</span>
            )}
          </h2>
          <PreviewToggle pillsShown={pillsShown} />
        </div>
        <p className={adminStyles.sectionHint}>
          The switch buttons sit at the bottom middle of every page, for your
          browser only. &ldquo;Switch to preview&rdquo; shows the real pages
          rendered from live Airtable data — open pages notice an edit within a
          few seconds and update themselves, no reload needed. The pink preview
          button switches you back, and always stays visible while preview mode
          is on, even with the switch buttons hidden here. Search keeps using
          the public site&rsquo;s prebuilt index, so a fresh edit reaches the
          search results later than the page itself. Visitors see none of this:
          they keep the fast prebuilt pages, which catch up on their own a
          couple of minutes after each edit.
        </p>
      </div>

      <div className={adminStyles.editorBlock}>
        <div className={adminStyles.editorBlockHeader}>
          <h2 className={adminStyles.editorBlockTitle}>Resource pages</h2>
        </div>
        <div className={styles.pageLinks}>
          {PAGES.map(page => (
            <a key={page.href} href={page.href} className={styles.pageLink}>
              {page.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
