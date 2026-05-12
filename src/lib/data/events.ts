import { getResources, type ResourceListing } from './event-and-training'

export type EventListing = ResourceListing

const EVENT_TYPES: ReadonlySet<string> = new Set([
  'Competition',
  'Conference',
  'Meetup',
  'Talk',
  'Workshop',
])

const EVENT_TYPE_ALIASES: Readonly<Record<string, string>> = {
  Hackathon: 'Competition',
  Unconference: 'Conference',
  'Reading Group': 'Meetup',
}

export function getEvents(): Promise<EventListing[]> {
  return getResources({
    allowedTypes: EVENT_TYPES,
    typeAliases: EVENT_TYPE_ALIASES,
  })
}
