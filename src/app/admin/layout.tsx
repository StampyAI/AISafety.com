import styles from './admin.module.css'

export const metadata = {
  title: 'Admin – AISafety.com',
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={styles.adminWrap}>{children}</div>
}
