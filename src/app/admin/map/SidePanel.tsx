'use client'

import { useMemo, useState } from 'react'
import type { EditorRecord } from '@/lib/admin/map-editor-core'
import { MAP_TABLE_ID } from '@/lib/admin/map-editor-core'
import { GRID_BOUNDS } from '@/lib/admin/map-geometry'
import adminStyles from '../admin.module.css'
import styles from './map-editor.module.css'

const AIRTABLE_BASE_URL = 'https://airtable.com/appF8XfZUGXtfi40E'

export type PanelTab = 'unplaced' | 'selected'

interface Props {
  records: EditorRecord[]
  selected: EditorRecord | null
  placeModeId: string | null
  tab: PanelTab
  onTabChange: (tab: PanelTab) => void
  onPlace: (id: string) => void
  onSetPosition: (id: string, x: number, y: number) => void
}

function Badges({ r }: { r: EditorRecord }) {
  return (
    <span className={styles.badges}>
      <span className={r.published ? styles.badgeLive : styles.badgeDraft}>
        {r.published ? 'Published' : 'Draft'}
      </span>
      {r.isMagic && <span className={styles.badgeWarn}>furniture</span>}
      {!r.mapLogo && <span className={styles.badgeWarn}>no map logo</span>}
      {!r.description && (
        <span className={styles.badgeWarn}>no description</span>
      )}
      {!r.scale && (
        <span className={styles.badgeWarn}>no Scale (drawn Medium)</span>
      )}
    </span>
  )
}

function airtableUrl(id: string): string {
  return `${AIRTABLE_BASE_URL}/${MAP_TABLE_ID}/${id}`
}

export default function SidePanel({
  records,
  selected,
  placeModeId,
  tab,
  onTabChange,
  onPlace,
  onSetPosition,
}: Props) {
  const [search, setSearch] = useState('')
  // Typed-but-not-yet-applied x/y for the selected record.
  const [draft, setDraft] = useState<{
    id: string
    x: string
    y: string
  } | null>(null)

  const unplaced = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records
      .filter(r => r.x === null || r.y === null)
      .filter(r => !q || r.title.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.published !== b.published) return a.published ? 1 : -1
        return a.title.localeCompare(b.title)
      })
  }, [records, search])

  const shownTab = tab
  const xValue =
    draft && selected && draft.id === selected.id
      ? draft.x
      : selected?.x === null || selected?.x === undefined
        ? ''
        : selected.x.toFixed(1)
  const yValue =
    draft && selected && draft.id === selected.id
      ? draft.y
      : selected?.y === null || selected?.y === undefined
        ? ''
        : selected.y.toFixed(1)

  const submitPosition = () => {
    if (!selected) return
    const x = Number(xValue)
    const y = Number(yValue)
    if (
      xValue === '' ||
      yValue === '' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    )
      return
    setDraft(null)
    onSetPosition(selected.id, x, y)
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${shownTab === 'unplaced' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('unplaced')}
        >
          Unplaced ({records.filter(r => r.x === null || r.y === null).length})
        </button>
        <button
          type="button"
          className={`${styles.tab} ${shownTab === 'selected' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('selected')}
        >
          Selected
        </button>
      </div>

      {shownTab === 'unplaced' && (
        <div className={styles.panelBody}>
          <input
            className={`${adminStyles.editorInput} ${styles.search}`}
            placeholder="Search unplaced…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {unplaced.length === 0 ? (
            <p className={adminStyles.sectionHint}>
              {search ? 'No matches.' : 'Everything has coordinates.'}
            </p>
          ) : (
            <ul className={styles.list}>
              {unplaced.map(r => (
                <li
                  key={r.id}
                  className={`${styles.row} ${
                    placeModeId === r.id ? styles.rowPlacing : ''
                  }`}
                >
                  <span className={styles.rowLogo}>
                    {r.mapLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.mapLogo} alt="" />
                    ) : (
                      <span className={styles.rowLogoMissing} />
                    )}
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{r.title}</span>
                    <span className={styles.rowMeta}>
                      {r.area ?? r.category ?? '—'}
                      {r.scale ? ` · ${r.scale}` : ''}
                    </span>
                    <Badges r={r} />
                  </span>
                  <button
                    type="button"
                    className={
                      placeModeId === r.id
                        ? adminStyles.editorButtonPrimary
                        : adminStyles.editorButton
                    }
                    onClick={() => onPlace(r.id)}
                  >
                    {placeModeId === r.id ? 'Placing…' : 'Place'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {shownTab === 'selected' && (
        <div className={styles.panelBody}>
          {!selected ? (
            <p className={adminStyles.sectionHint}>
              Click a logo on the map to select it.
            </p>
          ) : (
            <div className={styles.detail}>
              <div className={styles.detailHead}>
                <span className={styles.rowLogo}>
                  {selected.mapLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.mapLogo} alt="" />
                  ) : (
                    <span className={styles.rowLogoMissing} />
                  )}
                </span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{selected.title}</span>
                  <span className={styles.rowMeta}>
                    {selected.category || '—'}
                    {selected.area ? ` → ${selected.area}` : ''}
                  </span>
                  <Badges r={selected} />
                </span>
              </div>
              <dl className={styles.dl}>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
                <dt>Scale</dt>
                <dd>{selected.scale ?? 'not set – drawn as Medium'}</dd>
                <dt>Label</dt>
                <dd>{selected.labelName}</dd>
              </dl>
              <div className={styles.coords}>
                <label>
                  x
                  <input
                    className={adminStyles.editorInput}
                    type="number"
                    step="0.1"
                    min={GRID_BOUNDS.x[0]}
                    max={GRID_BOUNDS.x[1]}
                    value={xValue}
                    onChange={e =>
                      setDraft({
                        id: selected.id,
                        x: e.target.value,
                        y: yValue,
                      })
                    }
                    onKeyDown={e => e.key === 'Enter' && submitPosition()}
                  />
                </label>
                <label>
                  y
                  <input
                    className={adminStyles.editorInput}
                    type="number"
                    step="0.1"
                    min={GRID_BOUNDS.y[0]}
                    max={GRID_BOUNDS.y[1]}
                    value={yValue}
                    onChange={e =>
                      setDraft({
                        id: selected.id,
                        x: xValue,
                        y: e.target.value,
                      })
                    }
                    onKeyDown={e => e.key === 'Enter' && submitPosition()}
                  />
                </label>
                <button
                  type="button"
                  className={adminStyles.editorButton}
                  onClick={submitPosition}
                >
                  Set
                </button>
              </div>
              <p className={adminStyles.sectionHint}>
                Arrow keys nudge the selected logo by 0.1 (Shift: 1.0). Map is
                0–{GRID_BOUNDS.x[1]} wide, 0–{GRID_BOUNDS.y[1]} tall.
              </p>
              {(selected.x === null || selected.y === null) && (
                <button
                  type="button"
                  className={adminStyles.editorButtonPrimary}
                  onClick={() => onPlace(selected.id)}
                >
                  {placeModeId === selected.id ? 'Placing…' : 'Place on map'}
                </button>
              )}
              <a
                className={styles.airtableLink}
                href={airtableUrl(selected.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Airtable ↗
              </a>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
