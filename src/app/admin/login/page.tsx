import LoginForm from './LoginForm'
import styles from '../admin.module.css'

export default function AdminLoginPage() {
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>Admin</h1>
        <LoginForm />
      </div>
    </div>
  )
}
