// Single source of truth for the Anthropic model IDs the assistant talks to.
// Production uses DEFAULT_MODEL; the admin playground lets a human pick from
// MODELS when iterating on the prompt.

export interface AssistantModel {
  id: string
  shortLabel: string
  longLabel: string
}

export const MODELS: AssistantModel[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    shortLabel: 'Haiku 4.5',
    longLabel: 'Haiku 4.5 — fast',
  },
  {
    id: 'claude-sonnet-4-6',
    shortLabel: 'Sonnet 4.6',
    longLabel: 'Sonnet 4.6 — balanced',
  },
  {
    id: 'claude-opus-4-7',
    shortLabel: 'Opus 4.7',
    longLabel: 'Opus 4.7 — most capable',
  },
]

export const DEFAULT_MODEL_ID = MODELS[0].id

export function modelShortLabel(id: string): string {
  return MODELS.find(m => m.id === id)?.shortLabel ?? id
}
