import { fetchLastUpdated } from '@/lib/data/last-updated'
import { getTraining } from '@/lib/data/training'
import TrainingClient from './TrainingClient'

export default async function TrainingPage() {
  const [training, lastUpdated] = await Promise.all([
    getTraining(),
    fetchLastUpdated('training'),
  ])

  return (
    <div className="container-default">
      <TrainingClient
        training={training}
        lastUpdated={lastUpdated.formattedDate}
      />
    </div>
  )
}
