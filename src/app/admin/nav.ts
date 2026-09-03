// Shared admin navigation, used by every /admin section so the chatbot and
// analytics areas feel like one unified admin rather than two separate tools.

export interface AdminNavTab {
  href: string
  label: string
  /** Tabs are grouped in the header; a divider is drawn where the group changes
   *  (so the two chatbot tabs read as a pair, separate from Analytics). */
  group: 'chatbot' | 'analytics' | 'map' | 'preview' | 'newsletter'
}

export interface AdminAccess {
  /** Session may reach /admin/chatbot/* (every password but analytics-only). */
  chatbot: boolean
  /** Session may reach /admin/analytics (every password but Successif). */
  analytics: boolean
  /** Session may reach /admin/map (owner password only). */
  mapEditor: boolean
  /** Session may reach /admin/preview (every listing-editing role). */
  preview: boolean
  /** Session may reach /admin/newsletter (owner password only). */
  newsletter: boolean
}

/** Tabs shown in the admin header, limited to the areas this session can
 *  actually open — a tab the session would only be bounced out of is worse than
 *  no tab at all. */
export function adminTabs({
  chatbot,
  analytics,
  mapEditor,
  preview,
  newsletter,
}: AdminAccess): AdminNavTab[] {
  return [
    ...(chatbot
      ? [
          {
            href: '/admin/chatbot/playground',
            label: 'Playground',
            group: 'chatbot' as const,
          },
          {
            href: '/admin/chatbot/log',
            label: 'Conversation Log',
            group: 'chatbot' as const,
          },
        ]
      : []),
    ...(analytics
      ? [
          {
            href: '/admin/analytics',
            label: 'Analytics',
            group: 'analytics' as const,
          },
        ]
      : []),
    ...(mapEditor
      ? [
          {
            href: '/admin/map',
            label: 'Map editor',
            group: 'map' as const,
          },
        ]
      : []),
    ...(preview
      ? [
          {
            href: '/admin/preview',
            label: 'Site preview',
            group: 'preview' as const,
          },
        ]
      : []),
    ...(newsletter
      ? [
          {
            href: '/admin/newsletter',
            label: 'Newsletter',
            group: 'newsletter' as const,
          },
        ]
      : []),
  ]
}

/** Where a session should land when it has no particular destination: the
 *  first area it can open. Used for the header brand link and the post-login
 *  bounce so nobody is sent somewhere they'll be redirected out of. */
export function adminHomeHref({
  chatbot,
  analytics,
  mapEditor,
  preview,
  newsletter,
}: AdminAccess): string {
  if (chatbot) return '/admin/chatbot/playground'
  if (analytics) return '/admin/analytics'
  if (mapEditor) return '/admin/map'
  if (preview) return '/admin/preview'
  if (newsletter) return '/admin/newsletter'
  return '/admin/login'
}
