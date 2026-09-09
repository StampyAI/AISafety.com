import QueueAdmin from './QueueAdmin'

// Nothing here is prerendered: the page reads the queue live in the browser
// via /api/admin/queue.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function QueueAdminPage() {
  return <QueueAdmin />
}
