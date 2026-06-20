// Shared admin navigation, used by every /admin section so the chatbot and
// analytics areas feel like one unified admin rather than two separate tools.

export interface AdminNavTab {
  href: string
  label: string
  /** Tabs are grouped in the header; a divider is drawn where the group changes
   *  (so the two chatbot tabs read as a pair, separate from Analytics). */
  group: 'chatbot' | 'analytics'
}

/** Tabs shown in the admin header. Playground and Conversation Log always show;
 *  the Analytics tab is owner-only (the shared Successif password can't reach
 *  /admin/analytics), so it's only included when the session is the owner. */
export function adminTabs(owner: boolean): AdminNavTab[] {
  return [
    {
      href: '/admin/chatbot/playground',
      label: 'Playground',
      group: 'chatbot',
    },
    { href: '/admin/chatbot/log', label: 'Conversation Log', group: 'chatbot' },
    ...(owner
      ? [
          {
            href: '/admin/analytics',
            label: 'Analytics',
            group: 'analytics' as const,
          },
        ]
      : []),
  ]
}
