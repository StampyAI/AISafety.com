'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import styles from './admin.module.css'

export interface AdminTab {
  href: string
  label: string
}

interface Props {
  tabs?: AdminTab[]
}

export default function AdminHeader({ tabs }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' })
    } catch {
      // ignore
    }
    router.push('/admin/login')
    router.refresh()
  }
  return (
    <header className={styles.adminHeader}>
      <div className={styles.adminHeaderInner}>
        <Link href="/admin/assistant" className={styles.adminBrand}>
          AISafety Admin
        </Link>
        <nav className={styles.adminNav}>
          {tabs?.map(tab => {
            const active =
              pathname === tab.href ||
              (tab.href !== '/admin/assistant' && pathname.startsWith(tab.href))
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`${styles.adminNavLink} ${active ? styles.adminNavLinkActive : ''}`}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
        <div className={styles.adminHeaderRight}>
          <Link href="/" className={styles.adminBackLink}>
            ← Back to site
          </Link>
          <button
            type="button"
            className={styles.adminLogoutButton}
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
