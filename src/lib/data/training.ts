import { getResources, type ResourceListing } from './event-and-training'

export type TrainingListing = ResourceListing

const TRAINING_TYPES: ReadonlySet<string> = new Set([
  'Bootcamp',
  'Course',
  'Internship',
  'Research Program',
])

const TRAINING_TYPE_ALIASES: Readonly<Record<string, string>> = {
  'Academic Course': 'Course',
  Fellowship: 'Research Program',
}

export function getTraining(): Promise<TrainingListing[]> {
  return getResources({
    allowedTypes: TRAINING_TYPES,
    typeAliases: TRAINING_TYPE_ALIASES,
  })
}
