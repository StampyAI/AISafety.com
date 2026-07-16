import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin/auth'

// /admin is an index that bounces to the right place: the playground when
// already authenticated, otherwise the login page.
export default async function AdminIndexPage() {
  if (await isAdmin()) {
    redirect('/admin/chatbot/playground')
  }
  redirect('/admin/login')
}
