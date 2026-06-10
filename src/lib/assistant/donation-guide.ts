import { isValidElement, type ReactNode } from 'react'
import {
  DONATION_TABS,
  EXPANDABLE_COMPONENTS,
} from '@/app/donation-guide/content'

// Next.js forbids importing react-dom/server here, so instead of rendering the
// donation-guide components we walk their element trees and collect the text.
// The components are pure (no hooks), so calling them is just a function call.

const BLOCK_TAGS = new Set([
  'div',
  'p',
  'li',
  'ul',
  'ol',
  'section',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'br',
])

function nodeToText(node: ReactNode): string {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join('')
  if (isValidElement(node)) {
    const el = node as { type: unknown; props?: { children?: ReactNode } }
    const type = el.type
    const props = el.props ?? {}
    // TimeSection/Divider render text from their own props, so call them to
    // expand. Host tags, fragments, and next/link are walked via children
    // (we never invoke next/link, which would need a router/hooks context).
    if (typeof type === 'function' && EXPANDABLE_COMPONENTS.has(type)) {
      return nodeToText((type as (p: unknown) => ReactNode)(props))
    }
    const inner = nodeToText(props.children)
    return typeof type === 'string' && BLOCK_TAGS.has(type)
      ? `\n${inner}\n`
      : inner
  }
  return ''
}

let cached: string | null = null

/** The donation guide's full body text, broken down by amount bracket,
 *  extracted from the live page components. Memoised per process and
 *  regenerated on each deploy, so it always reflects the current guide. */
export function getDonationGuideText(): string {
  if (cached !== null) return cached
  const sections = DONATION_TABS.map(tab => {
    const body = nodeToText(tab.Content())
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return `## If donating ${tab.label}\n${body}`
  })
  cached =
    'DONATION GUIDE (/donation-guide) — the full content of the donation guide page, by donation amount. Use this to answer donation questions with the guide’s own recommendations, and still link the user to [Donation guide](/donation-guide).\n\n' +
    sections.join('\n\n')
  return cached
}
