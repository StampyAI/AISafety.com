'use client'

import type { ComponentPropsWithoutRef, RefObject } from 'react'
import { useRef } from 'react'
import styles from './SearchBar.module.css'

type NativeInputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange'
>

interface SearchBarProps extends NativeInputProps {
  value: string
  onChange: (value: string) => void
  inputRef?: RefObject<HTMLInputElement | null>
  wrapperClassName?: string
  className?: string
  clearButtonClassName?: string
  showClearButton?: boolean
}

export default function SearchBar({
  value,
  onChange,
  placeholder,
  maxLength = 256,
  inputRef,
  wrapperClassName,
  className,
  clearButtonClassName,
  showClearButton = true,
  ...inputProps
}: SearchBarProps) {
  const fallbackInputRef = useRef<HTMLInputElement>(null)
  const resolvedInputRef = inputRef ?? fallbackInputRef
  const showClear = showClearButton && value.length > 0

  const clearSearch = () => {
    // Only restore focus if the input was already focused (e.g. mid-typing on
    // desktop). On mobile the clear button stays visible after the field has
    // blurred, so refocusing here would pop the on-screen keyboard back up when
    // the user is just trying to reset and browse.
    const wasFocused = resolvedInputRef.current === document.activeElement
    onChange('')
    if (wasFocused) {
      resolvedInputRef.current?.focus()
    }
  }

  return (
    <div
      className={`${styles.wrapper}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
    >
      <input
        ref={resolvedInputRef}
        type="text"
        {...inputProps}
        className={`text-field ${styles.input}${className ? ` ${className}` : ''}`}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
      {showClear ? (
        <button
          type="button"
          className={`${styles.clearButton}${clearButtonClassName ? ` ${clearButtonClassName}` : ''}`}
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
