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

export const metadata = {
  title: 'Newsletters – AISafety.com',
  robots: { index: false, follow: false },
}

export default async function NewsletterAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const chatbot = await canViewChatbot()
  const analytics = await canViewAnalytics()
  const mapEditor = await canEditMap()
  const preview = await canUsePreview()
  // Only the owner password may send to subscribers. Anyone else who is
  // signed in goes to the area they can use; signed-out sessions to login.
  if (!(await canSendNewsletter())) {
    redirect(
      adminHomeHref({
        chatbot,
        analytics,
        mapEditor,
        preview,
        newsletter: false,
      })
    )
  }
  const access = { chatbot, analytics, mapEditor, preview, newsletter: true }
  return (
    <>
      <AdminHeader tabs={adminTabs(access)} brandHref={adminHomeHref(access)} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
