import { redirect } from 'next/navigation'
import {
  canEditMap,
  canSendNewsletter,
  canUsePreview,
  canViewAnalytics,
  canViewChatbot,
} from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import { adminTabs, adminHomeHref } from '../nav'
import styles from '../admin.module.css'

export default async function ChatbotAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const analytics = await canViewAnalytics()
  // A signed-in analytics-only volunteer is sent to the dashboard they're
  // allowed to use; everyone else to the login page.
  if (!(await canViewChatbot())) {
    redirect(analytics ? '/admin/analytics' : '/admin/login')
  }
  // Chatbot access is guaranteed here; adminTabs() still hides the Analytics tab
  // from sessions that can't reach it (e.g. Successif).
  const access = {
    chatbot: true,
    analytics,
    mapEditor: await canEditMap(),
    preview: await canUsePreview(),
    newsletter: await canSendNewsletter(),
  }
  return (
    <>
      <AdminHeader tabs={adminTabs(access)} brandHref={adminHomeHref(access)} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
