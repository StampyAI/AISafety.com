// Activity level → pulse-icon height. There are four levels but three icons, so
// Active and Very active share the tall pulse for now (Bryce is looking at
// collapsing the data to three).
export const activityIcon = (level: string) =>
  level === 'Inactive'
    ? '/images/icons/activity-low.svg'
    : level === 'Semi-active'
      ? '/images/icons/activity-mid.svg'
      : '/images/icons/activity-high.svg'
