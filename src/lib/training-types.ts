export const TRAINING_TYPES = [
  'Fellowship',
  'Course',
  'Bootcamp',
  'Other',
] as const

export type TrainingType = (typeof TRAINING_TYPES)[number]

const TRAINING_TYPE_COLOR: Record<string, string> = {
  Fellowship: 'color-orange',
  Bootcamp: 'color-pink',
  Course: 'color-bright-green',
  Other: 'color-teal-300',
}

export function trainingTypeColor(type: string): string {
  return TRAINING_TYPE_COLOR[type] ?? 'color-teal-bright-400'
}

export const ENTRY_BARS = ['Low', 'Mid', 'High'] as const
export type EntryBar = (typeof ENTRY_BARS)[number]

// Options for the Stipend filter. Records may still hold the unresolved
// third option "Living expenses covered" — those cards display the value
// but only match the filter once the team settles the option set.
export const STIPEND_OPTIONS = ['No stipend', 'Stipend included'] as const

export const LENGTH_BUCKETS = [
  'Under 1 month',
  '1–3 months',
  '3+ months',
] as const
export type LengthBucket = (typeof LENGTH_BUCKETS)[number]
