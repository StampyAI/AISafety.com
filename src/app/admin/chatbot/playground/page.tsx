import { PRODUCTION_PROMPT, PROMPT_VERSION } from '@/lib/assistant/prompt'
import AssistantAdmin from '../AssistantAdmin'

export default function PlaygroundPage() {
  return (
    <AssistantAdmin
      productionPrompt={PRODUCTION_PROMPT}
      promptVersion={PROMPT_VERSION}
    />
  )
}
