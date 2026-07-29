'use client'

import styles from './MapControls.module.css'

interface MapControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  /** Positioning class from the page's CSS module (top/right offsets, z-index) */
  className: string
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: MapControlsProps) {
  return (
    <div className={className}>
      <div className={styles.group}>
        <button className={styles.button} title="Zoom in" onClick={onZoomIn}>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 2.5C8.27614 2.5 8.5 2.72386 8.5 3V7.5H13C13.2761 7.5 13.5 7.72386 13.5 8C13.5 8.27614 13.2761 8.5 13 8.5H8.5V13C8.5 13.2761 8.27614 13.5 8 13.5C7.72386 13.5 7.5 13.2761 7.5 13V8.5H3C2.72386 8.5 2.5 8.27614 2.5 8C2.5 7.72386 2.72386 7.5 3 7.5H7.5V3C7.5 2.72386 7.72386 2.5 8 2.5Z"
              fill="white"
            />
          </svg>
        </button>
        <button className={styles.button} title="Zoom out" onClick={onZoomOut}>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.5 8C2.5 7.72386 2.72386 7.5 3 7.5H13C13.2761 7.5 13.5 7.72386 13.5 8C13.5 8.27614 13.2761 8.5 13 8.5H3C2.72386 8.5 2.5 8.27614 2.5 8Z"
              fill="white"
            />
          </svg>
        </button>
        <button className={styles.button} title="Reset view" onClick={onReset}>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2.5 8a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"
              fill="white"
            />
            <circle cx="8" cy="8" r="1.5" fill="white" />
          </svg>
        </button>
      </div>
    </div>
  )
}
