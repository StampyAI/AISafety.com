import { redirect } from 'next/navigation'
import { canViewAnalytics, isAdmin } from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import { adminTabs } from '../nav'
import styles from '../admin.module.css'

export default async function ChatbotAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await isAdmin())) {
    redirect('/admin/login')
  }
  // adminTabs() hides the Analytics tab from sessions that can't reach it
  // (e.g. Successif; owner and volunteers see it).
  return (
    <>
      <AdminHeader tabs={adminTabs(await canViewAnalytics())} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
