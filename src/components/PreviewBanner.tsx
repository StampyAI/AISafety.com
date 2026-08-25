import { isPreviewRequest } from '@/lib/preview'
import EnterPreviewButton from './EnterPreviewButton'
import ExitPreviewButton from './ExitPreviewButton'
import PreviewAutoRefresh from './PreviewAutoRefresh'

/** The floating switch pill, bottom middle of every page. In preview mode it
 *  always shows (a browser must never be in preview without knowing it, or
 *  without a way out): "Preview · public built X ago" — click to return to
 *  the public view. Outside preview it renders the self-hiding "Switch to
 *  preview" pill, visible only when the switch pills are turned on at
 *  /admin/preview — and never anything in the static HTML normal visitors
 *  get. */
export default async function PreviewBanner() {
  if (!(await isPreviewRequest())) return <EnterPreviewButton />

  // BUILD_TIME (next.config.ts) is when the running deployment was built =
  // the newest data a normal visitor can be seeing. A large age here while
  // edits are pending means the rebuild pipeline is stalled.
  const buildTime = process.env.BUILD_TIME ?? null

  return (
    <>
      <ExitPreviewButton buildTime={buildTime} />
      <PreviewAutoRefresh />
    </>
  )
}
