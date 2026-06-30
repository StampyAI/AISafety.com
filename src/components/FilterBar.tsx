import type { ReactNode } from 'react'

interface FilterBarProps {
  /** The FilterDropdown pills. */
  children: ReactNode
  /** Number of results currently shown. */
  count: number
  /** Singular noun for the count, e.g. "course". Pluralized with an "s". */
  noun: string
  label?: ReactNode
}

// Horizontal row of filter dropdowns with a result count on the right, sitting
// above the listing grid (replacing the old vertical FilterSidebar). Static —
// it scrolls away with the page.
export default function FilterBar({
  children,
  count,
  noun,
  label,
}: FilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-16px padding-bottom-40px">
      <div className="flex items-center gap-8px" style={{ flexWrap: 'wrap' }}>
        {children}
      </div>
      <p
        className="paragraph-small color-teal-300"
        style={{ whiteSpace: 'nowrap' }}
      >
        {label ?? `${count} ${noun}${count === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}
