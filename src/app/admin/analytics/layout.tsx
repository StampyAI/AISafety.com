import { redirect } from 'next/navigation'
import { canEditMap, canViewAnalytics, canViewChatbot } from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import { adminTabs, adminHomeHref } from '../nav'
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
  const chatbot = await canViewChatbot()
  // A signed-in partner holding the Successif password is sent to the chat area
  // they're allowed to use; everyone else to the login page.
  if (!(await canViewAnalytics())) {
    redirect(chatbot ? '/admin/chatbot/playground' : '/admin/login')
  }
  // Analytics access is guaranteed here, so the Analytics tab is always present;
  // the chatbot tabs drop out for an analytics-only session.
  const access = { chatbot, analytics: true, mapEditor: await canEditMap() }
  return (
    <>
      <AdminHeader tabs={adminTabs(access)} brandHref={adminHomeHref(access)} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
