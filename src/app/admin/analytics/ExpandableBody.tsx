'use client'

import { Children, useState, type ReactNode } from 'react'
import styles from './analytics.module.css'

/** A table <tbody> that shows only the first `initial` rows, with a button that
 *  reveals `step` more on each click. The rows are rendered on the server and
 *  handed in as children, so every per-row detail (logos, links, pills) stays
 *  server-side; this component only decides how many are visible. When the row
 *  count is at or below `initial`, no button renders and it behaves like a plain
 *  <tbody>. `colSpan` must match the table's column count so the button row
 *  spans the full width. */
export default function ExpandableBody({
  children,
  colSpan,
  initial = 50,
  step = 50,
}: {
  children: ReactNode
  colSpan: number
  initial?: number
  step?: number
}) {
  const rows = Children.toArray(children)
  const [visible, setVisible] = useState(initial)
  const remaining = rows.length - visible
  return (
    <tbody>
      {rows.slice(0, visible)}
      {remaining > 0 && (
        <tr className={styles.showMoreRow}>
          <td colSpan={colSpan}>
            <button
              type="button"
              className={styles.showMoreBtn}
              onClick={() => setVisible(v => v + step)}
            >
              Show {Math.min(step, remaining)} more · {remaining} hidden
            </button>
          </td>
        </tr>
      )}
    </tbody>
  )
}
