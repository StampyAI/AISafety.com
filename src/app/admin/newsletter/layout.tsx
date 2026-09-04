import { redirect } from 'next/navigation'
import {
  currentAccess,
  currentAdmin,
  hasFreshSession,
  NEWSLETTER_FRESH_SECONDS,
} from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import { pendingRequestCount } from '@/lib/admin/users-store'
import { adminTabs, adminHomeHref } from '../nav'
import styles from '../admin.module.css'

export const metadata = {
  title: 'Newsletters – AISafety.com',
  robots: { index: false, follow: false },
}

export default async function NewsletterAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await currentAccess()
  // Every approval on this page is a real send.
  // Anyone signed in without it goes to the first area they do have;
  // signed-out sessions to login.
  if (!access.newsletter) {
    redirect(adminHomeHref(access))
  }
  // Approvals send real email, so the session must have come through Google
  // recently. An older session takes one more trip through Google's account
  // chooser and lands straight back here.
  if (!(await hasFreshSession(NEWSLETTER_FRESH_SECONDS))) {
    redirect('/api/admin/auth/google?next=/admin/newsletter')
  }
  const who = await currentAdmin()
  // Badge on the Admin admin tab: people waiting to be approved.
  const pendingRequests = access.manageUsers ? await pendingRequestCount() : 0
  return (
    <>
      <AdminHeader
        tabs={adminTabs(access, { pendingRequests })}
        brandHref={adminHomeHref(access)}
        signedInAs={who?.name}
      />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
