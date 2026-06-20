import { redirect } from 'next/navigation'
import { isAdmin, isOwner } from '@/lib/admin/auth'
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
  // adminTabs() hides the Analytics tab from non-owners (e.g. Successif).
  return (
    <>
      <AdminHeader tabs={adminTabs(await isOwner())} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
