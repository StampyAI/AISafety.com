import { fetchLastUpdated } from '@/lib/data/last-updated'
import { getEvents } from '@/lib/data/events'
import EventsClient from './EventsClient'

export default async function EventsPage() {
  const [events, lastUpdated] = await Promise.all([
    getEvents(),
    fetchLastUpdated('events'),
  ])

  return (
    <div className="container-default">
      <EventsClient events={events} lastUpdated={lastUpdated.formattedDate} />
    </div>
  )
}
