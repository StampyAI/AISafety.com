import { redirect } from 'next/navigation'
import { isAdmin, isOwner } from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import { adminTabs } from '../nav'
import styles from '../admin.module.css'

export const metadata = {
  title: 'Analytics – AISafety.com',
  robots: { index: false, follow: false },
}

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Owner-only. A signed-in partner holding the Successif password is sent to
  // the chat area they're allowed to use; everyone else to the login page.
  if (!(await isOwner())) {
    redirect((await isAdmin()) ? '/admin/chatbot/playground' : '/admin/login')
  }
  // owner is guaranteed here, so the Analytics tab is always present.
  return (
    <>
      <AdminHeader tabs={adminTabs(true)} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
