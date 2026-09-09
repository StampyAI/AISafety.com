import { redirect } from 'next/navigation'
import { currentAccess, currentAdmin } from '@/lib/admin/auth'
import { pendingQueueCount } from '@/lib/admin/queue'
import AdminHeader from '../AdminHeader'
import { adminTabs, adminHomeHref } from '../nav'
import styles from '../admin.module.css'

export default async function QueueAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await currentAccess()
  // Every accept writes to the live base. Anyone signed in without the area
  // goes to the first area they do have; signed-out sessions to login.
  if (!access.queue) {
    redirect(adminHomeHref(access))
  }
  const who = await currentAdmin()
  const pendingQueue = await pendingQueueCount()
  return (
    <>
      <AdminHeader
        tabs={adminTabs(access, { pendingQueue })}
        brandHref={adminHomeHref(access)}
        signedInAs={who?.name}
      />
      <main className={styles.consoleWrap}>{children}</main>
    </>
  )
}
