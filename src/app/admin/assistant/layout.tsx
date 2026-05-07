import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import styles from '../admin.module.css'

const TABS = [
  { href: '/admin/assistant', label: 'Playground' },
  { href: '/admin/assistant/conversations', label: 'Conversations' },
]

export default async function AssistantAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await isAdmin())) {
    redirect('/admin/login')
  }
  return (
    <>
      <AdminHeader tabs={TABS} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
