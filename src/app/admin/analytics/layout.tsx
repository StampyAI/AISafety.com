import { redirect } from 'next/navigation'
import { canViewAnalytics, isAdmin } from '@/lib/admin/auth'
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
  // Owner and volunteers only. A signed-in partner holding the Successif
  // password is sent to the chat area they're allowed to use; everyone else to
  // the login page.
  if (!(await canViewAnalytics())) {
    redirect((await isAdmin()) ? '/admin/chatbot/playground' : '/admin/login')
  }
  // analytics access is guaranteed here, so the Analytics tab is always present.
  return (
    <>
      <AdminHeader tabs={adminTabs(true)} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
