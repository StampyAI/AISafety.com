import { redirect } from 'next/navigation'
import {
  canEditMap,
  canUsePreview,
  canViewAnalytics,
  canViewChatbot,
} from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import { adminTabs, adminHomeHref } from '../nav'
import styles from '../admin.module.css'

export const metadata = {
  title: 'Site preview – AISafety.com',
  robots: { index: false, follow: false },
}

export default async function PreviewAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const chatbot = await canViewChatbot()
  const analytics = await canViewAnalytics()
  // Listing-editing roles only (owner, volunteers, Melissa). Anyone else who
  // is signed in goes to the area they can use; signed-out sessions to login.
  if (!(await canUsePreview())) {
    redirect(
      adminHomeHref({
        chatbot,
        analytics,
        mapEditor: await canEditMap(),
        preview: false,
      })
    )
  }
  const access = {
    chatbot,
    analytics,
    mapEditor: await canEditMap(),
    preview: true,
  }
  return (
    <>
      <AdminHeader tabs={adminTabs(access)} brandHref={adminHomeHref(access)} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
