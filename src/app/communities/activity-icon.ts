// Activity level → pulse-icon height. There are four levels but three icons, so
// Active and Very active share the tall pulse. Anything unrecognised gets the
// plain pulse rather than reading as very active.
export const activityIcon = (level: string) => {
  switch (level) {
    case 'Inactive':
      return '/images/icons/activity-low.svg'
    case 'Semi-active':
      return '/images/icons/activity-mid.svg'
    case 'Active':
    case 'Very active':
      return '/images/icons/activity-high.svg'
    default:
      return '/images/icons/activity.svg'
  }
}
