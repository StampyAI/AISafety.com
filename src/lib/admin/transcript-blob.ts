/* Full-transcript mirror for the conversation log.

   Airtable's long-text limit caps the serialized Data row at ~90k characters,
   so a long conversation loses its oldest messages there (window + size
   trim in upsertConversation). Conversations that outgrow the row mirror
   their COMPLETE history to a JSON file in Vercel Blob — the same store the
   Airtable image mirror in lib/data/airtable.ts uses — and the row keeps the
   file's URL in Data.transcript. Short conversations never write one.

   The store serves blobs publicly, so the unguessable random pathname is the
   access control: the URL only ever lives inside the admin-only Airtable row
   and is never sent to the visitor's browser.
*/

import { put } from '@vercel/blob'
import { randomUUID } from 'node:crypto'

const PREFIX = 'chatlogs/'

export interface TranscriptPayload {
  v: 1
  history: { role: 'user' | 'assistant'; content: string }[]
  /** Each message's position in the visitor's own message list — the same
   *  indexing Data.historyIndices uses. Aligned with `history`. */
  historyIndices: number[]
}

/** Writes a conversation's full transcript, overwriting its existing blob
 *  when it has one (`existingUrl`) so each conversation keeps one stable
 *  file. Returns the blob URL, or null when the write failed or no token is
 *  configured — the Airtable log write must go on without the mirror. */
export async function writeTranscript(
  existingUrl: string | null | undefined,
  payload: Omit<TranscriptPayload, 'v'>
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      '[assistant] BLOB_READ_WRITE_TOKEN not set — full transcript not mirrored'
    )
    return null
  }
  const pathname = existingUrl
    ? new URL(existingUrl).pathname.replace(/^\//, '')
    : `${PREFIX}${randomUUID()}.json`
  try {
    const blob = await put(pathname, JSON.stringify({ v: 1, ...payload }), {
      access: 'public',
      addRandomSuffix: false,
      // Each turn overwrites the file with a longer version of itself.
      allowOverwrite: true,
      contentType: 'application/json',
      // Kept short so the admin reads recent turns, not a stale edge copy.
      cacheControlMaxAge: 60,
    })
    return blob.url
  } catch (err) {
    console.warn(
      `[assistant] transcript blob write failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}

/** Fetches a mirrored transcript. Null on any failure — the caller falls
 *  back to the windowed history stored in the Airtable row. */
export async function readTranscript(
  url: string
): Promise<TranscriptPayload | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[admin] transcript blob fetch failed: HTTP ${res.status}`)
      return null
    }
    const parsed = (await res.json()) as TranscriptPayload
    const shapeOk =
      Array.isArray(parsed?.history) &&
      Array.isArray(parsed?.historyIndices) &&
      parsed.history.length === parsed.historyIndices.length &&
      parsed.history.every(
        m =>
          (m?.role === 'user' || m?.role === 'assistant') &&
          typeof m?.content === 'string'
      ) &&
      parsed.historyIndices.every(n => typeof n === 'number')
    if (!shapeOk) {
      console.warn('[admin] transcript blob has an unexpected shape')
      return null
    }
    return parsed
  } catch (err) {
    console.warn(
      `[admin] transcript blob fetch failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}
