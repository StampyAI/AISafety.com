import type { ReactNode } from 'react'

// Wraps the list of FilterGroup components in the desktop sidebar.
// Centralizes filter-list styling so spacing changes happen in one place.
// The bottom margin is the gap to the ContributeButtons card that follows it
// (previously a top margin on ContributeButtons itself, which the redesigned
// self-study layout — with no FilterSidebar — needs to omit).
export default function FilterSidebar({ children }: { children: ReactNode }) {
  return <div className="margin-bottom-40px">{children}</div>
}
