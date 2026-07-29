import { getRecurringPrograms, getTrainingPrograms } from '@/lib/data/training'
import { createCollectionHandler, OPTIONS } from '@/lib/api/handler'

// One collection for both /training views: dated upcoming rounds first
// (soonest start date), then the evergreen recurring programs, told apart by
// the `recurring` flag.
async function getAllTraining() {
  const [upcoming, recurring] = await Promise.all([
    getTrainingPrograms(),
    getRecurringPrograms(),
  ])
  return [
    ...upcoming.map(program => ({ ...program, recurring: false })),
    ...recurring.map(program => ({ ...program, recurring: true })),
  ]
}

export const dynamic = 'force-dynamic'
export const GET = createCollectionHandler('training', getAllTraining)
export { OPTIONS }
