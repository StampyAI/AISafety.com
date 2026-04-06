import type { ReactNode } from 'react'

// Wraps the list of FilterGroup components in the desktop sidebar.
// Centralizes filter-list styling so spacing changes happen in one place.
export default function FilterSidebar({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}
