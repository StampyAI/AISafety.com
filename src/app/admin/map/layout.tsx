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
  title: 'Map editor – AISafety.com',
  robots: { index: false, follow: false },
}

export default async function MapEditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const chatbot = await canViewChatbot()
  const analytics = await canViewAnalytics()
  // Only the owner password may move logos on the live map. Anyone else who
  // is signed in goes to the area they can use; signed-out sessions to login.
  if (!(await canEditMap())) {
    redirect(
      adminHomeHref({
        chatbot,
        analytics,
        mapEditor: false,
        preview: await canUsePreview(),
      })
    )
  }
  const access = {
    chatbot,
    analytics,
    mapEditor: true,
    preview: await canUsePreview(),
  }
  return (
    <>
      <AdminHeader tabs={adminTabs(access)} brandHref={adminHomeHref(access)} />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
