import { redirect } from 'next/navigation'
import { currentAccess, currentAdmin } from '@/lib/admin/auth'
import AdminHeader from '../AdminHeader'
import { adminTabs, adminHomeHref } from '../nav'

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
  // No consoleWrap here: the Queue paints its own full-width surface
  // (queue.module.css) below the shared admin header.
  return (
    <>
      <AdminHeader
        tabs={adminTabs(access)}
        brandHref={adminHomeHref(access)}
        signedInAs={who?.name}
      />
      <main>{children}</main>
    </>
  )
}
