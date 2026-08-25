#!/usr/bin/env node
// Guardrail: an icon file's NATIVE size is its ONLY display size.
// A 16px icon renders at 16, a 24px icon at 24, etc. — never scaled. If you
// need another size, that's a different file (e.g. x.svg vs x-small.svg).
// This checks every static <Icon src="/images/icons/…" size={N} /> against the
// file's own width. Dynamic src={…} usages are reported as unverifiable.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ICONS_DIR = 'public/images/icons'
const SRC_DIR = 'src'

// native size per icon file (from its width="N" attribute)
const native = {}
for (const f of readdirSync(ICONS_DIR)) {
  if (!f.endsWith('.svg')) continue
  const svg = readFileSync(join(ICONS_DIR, f), 'utf8')
  const w = svg.match(/width="(\d+)"/)
  if (w) native[`/images/icons/${f}`] = Number(w[1])
}

// walk src/ for .tsx/.ts files
function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (/\.(tsx?|)$/.test(e.name) && /\.(tsx|ts)$/.test(e.name)) out.push(p)
  }
  return out
}

const mismatches = []
const dynamic = []
for (const file of walk(SRC_DIR)) {
  const src = readFileSync(file, 'utf8')
  // each self-closing <Icon ... /> (props may span lines)
  for (const m of src.matchAll(/<Icon\b([^>]*?)\/>/gs)) {
    const props = m[1]
    const line = src.slice(0, m.index).split('\n').length
    const srcLit = props.match(/src="([^"]+)"/)
    if (!srcLit) {
      dynamic.push(`${file}:${line}  src={…} (dynamic — verify by hand)`)
      continue
    }
    const path = srcLit[1]
    const nat = native[path]
    if (nat === undefined) continue // not a library icon (shouldn't happen)
    const sizeM = props.match(/size=\{(\d+)\}/)
    const size = sizeM ? Number(sizeM[1]) : 16 // default
    if (size !== nat) {
      mismatches.push(
        `${file}:${line}  ${path} is ${nat}px but shown at ${size}px`
      )
    }
  }
}

if (dynamic.length) {
  console.log(`\nℹ ${dynamic.length} dynamic-src <Icon> usage(s) (not auto-checkable):`)
  for (const d of dynamic) console.log('   ' + d)
}
if (mismatches.length) {
  console.error(`\n✖ ${mismatches.length} icon size mismatch(es) — a file's native size IS its display size:`)
  for (const x of mismatches) console.error('   ' + x)
  console.error('\nFix: display the icon at its native size, or use the correctly-sized file (e.g. x-small.svg for 12px).')
  process.exit(1)
}
console.log('\n✓ every static <Icon> renders at its file\'s native size')
