import { isConversationsTableConfigured } from '@/lib/admin/airtable'
import ConversationList from '../ConversationList'
import styles from '../../admin.module.css'

export default function ConversationsPage() {
  const configured = isConversationsTableConfigured()
  return (
    <div className={styles.convPage}>
      <div className={styles.pageHeading}>
        <h1 className={styles.pageTitle}>Conversations</h1>
      </div>
      {configured ? (
        <ConversationList />
      ) : (
        <div className={styles.notice}>
          Set <code>ADMIN_CONVERSATIONS_TABLE_ID</code> in env to read the
          conversation log.
        </div>
      )}
    </div>
  )
}
