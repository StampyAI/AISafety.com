'use client'

import { useRef } from 'react'
import styles from './SearchBar.module.css'

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
  const inputRef = useRef<HTMLInputElement>(null)

  const clearSearch = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="text"
        className={`text-field ${styles.input}`}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
      {value.length > 0 ? (
        <button
          type="button"
          className={styles.clearButton}
          aria-label="Clear search"
          onMouseDown={event => event.preventDefault()}
          onClick={clearSearch}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
