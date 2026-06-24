export const EVENT_TYPES = [
  'Competition',
  'Conference',
  'Meetup',
  'Talk',
  'Workshop',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

const EVENT_TYPE_COLOR: Record<string, string> = {
  Conference: 'color-orange',
  Talk: 'color-pink',
  Workshop: 'color-bright-green',
  Meetup: 'color-blue',
  Hackathon: 'color-purple',
  Competition: 'color-yellow',
}

export function eventTypeColor(type: string): string {
  return EVENT_TYPE_COLOR[type] ?? 'color-teal-bright-400'
}
