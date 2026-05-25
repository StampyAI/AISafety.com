'use client'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  maxLength?: number
}

export default function SearchBar({
  value,
  onChange,
  placeholder,
  maxLength = 256,
}: SearchBarProps) {
  return (
    <input
      type="text"
      className="text-field"
      placeholder={placeholder}
      maxLength={maxLength}
      value={value}
      onChange={event => onChange(event.target.value)}
    />
  )
}
