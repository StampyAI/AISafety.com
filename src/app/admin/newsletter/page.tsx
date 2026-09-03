import NewsletterAdmin from './NewsletterAdmin'

// Nothing here is prerendered: the page reads ActiveCampaign live in the
// browser via /api/admin/newsletter.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function NewsletterAdminPage() {
  return <NewsletterAdmin />
}
