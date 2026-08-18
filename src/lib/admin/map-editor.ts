/*
  Server-side Airtable I/O for the admin map editor.

  Reads the Map table LIVE (cache: 'no-store', no view, unpublished rows
  included, Hide? rows excluded) and writes exactly two fields (x, y) on one
  record at a time. It intentionally does not use src/lib/data/airtable.ts:
  that path is wrapped in unstable_cache (shared with /map, the chatbot
  catalog, search and the public API), filters to published rows, and mirrors
  attachments to Vercel Blob. Nothing here touches that cache or those files.

  Logo URLs returned by a live read are Airtable-signed and expire in ~2h.
  They are only ever sent to the signed-in admin's browser, never persisted.
*/

import { airtableRequest, listAll } from './airtable'
import {
  buildPositionFields,
  FIELD,
  MAP_TABLE_ID,
  num,
  READ_FIELDS,
  rowToEditorRecord,
  sortEditorRecords,
  type EditorRecord,
} from './map-editor-core'

export function isMapEditorConfigured(): boolean {
  return Boolean(process.env.AIRTABLE_TOKEN && process.env.AIRTABLE_BASE_ID)
}

type RawFields = Record<string, unknown>

/** Every non-hidden Map record, published or not, in /map stacking order. */
export async function listMapRecordsLive(): Promise<EditorRecord[]> {
  const params = new URLSearchParams()
  params.set('filterByFormula', `{${FIELD.hide}} = FALSE()`)
  params.set('returnFieldsByFieldId', 'true')
  for (const f of READ_FIELDS) params.append('fields[]', f)
  const rows = await listAll<RawFields>(MAP_TABLE_ID, params)
  return sortEditorRecords(rows.map(rowToEditorRecord))
}

export interface StoredPosition {
  x: number | null
  y: number | null
}

/** Current x/y for one record, or null when the record doesn't exist. Airtable
 *  answers an unknown record id with 404, or with 403 "model not found" when
 *  the id doesn't belong to this table — both mean "not here". */
export async function getMapPosition(
  id: string
): Promise<StoredPosition | null> {
  // The single-record endpoint takes returnFieldsByFieldId but no fields[].
  const res = await airtableRequest(
    `${MAP_TABLE_ID}/${id}?returnFieldsByFieldId=true`
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 403 && text.includes('MODEL_NOT_FOUND')) return null
    throw new Error(`Airtable read failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as { fields: RawFields }
  return { x: num(data.fields[FIELD.x]), y: num(data.fields[FIELD.y]) }
}

/** Writes x and y (nothing else) and returns what Airtable stored. */
export async function updateMapPosition(
  id: string,
  x: number,
  y: number
): Promise<{ x: number; y: number }> {
  const res = await airtableRequest(`${MAP_TABLE_ID}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: buildPositionFields(x, y),
      returnFieldsByFieldId: true,
    }),
  })
  if (!res.ok) {
    throw new Error(`Airtable update failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { fields: RawFields }
  const storedX = num(data.fields[FIELD.x])
  const storedY = num(data.fields[FIELD.y])
  if (storedX === null || storedY === null) {
    throw new Error(
      `Airtable update returned no x/y for ${id}: ${JSON.stringify(data.fields)}`
    )
  }
  return { x: storedX, y: storedY }
}
