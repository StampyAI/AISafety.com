'use client'

interface FilterGroupProps {
  title: string
  options: string[]
  selected: string[]
  counts: Record<string, number>
  onToggle: (value: string) => void
  // Optional map from option value to the label shown to the user. Filtering
  // and counts still run on the raw option values; only the display changes.
  labels?: Record<string, string>
}

export default function FilterGroup({
  title,
  options,
  selected,
  counts,
  onToggle,
  labels,
}: FilterGroupProps) {
  return (
    <div className="padding-bottom-40px">
      <p className="paragraph-small-bold color-white padding-bottom-16px">
        {title}
      </p>
      <div className="flex flex-col gap-16px">
        {options.map(option => (
          <label key={option} className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="checkbox"
            />
            <span className="paragraph-small color-teal-300">
              {labels?.[option] ?? option}
              <span className="filter-count"> ({counts[option] || 0})</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
