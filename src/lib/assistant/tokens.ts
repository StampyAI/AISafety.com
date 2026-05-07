// Pure-text utilities for the chip directive (`[[chip:TEXT]]`). Lives in
// /lib so server, ChatBody, ThinkingBlock, and MessageContent can all share
// it without forcing a React import path.

const CHIP_TOKEN = /\[\[chip:[^\]\n]*\]\]/g

/** Removes `[[chip:...]]` markers from rendered text and collapses any
 *  blank lines they leave behind. */
export function stripChipTokens(text: string): string {
  return text
    .replace(CHIP_TOKEN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}

/** Extracts up to 3 follow-up chip strings from the assistant's reply. */
export function extractChips(text: string): string[] {
  const out: string[] = []
  let m
  CHIP_TOKEN.lastIndex = 0
  while ((m = CHIP_TOKEN.exec(text)) !== null) {
    const value = m[0].slice('[[chip:'.length, -']]'.length).trim()
    if (value) out.push(value)
  }
  return out.slice(0, 3)
}
