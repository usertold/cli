export const WORK_EFFORT_ESTIMATES = ['xs', 's', 'm', 'l', 'xl'] as const;
export type WorkEffortEstimate = (typeof WORK_EFFORT_ESTIMATES)[number];

const WORK_EFFORT_ESTIMATE_SET = new Set<string>(WORK_EFFORT_ESTIMATES);

export function isWorkEffortEstimate(value: string | null | undefined): value is WorkEffortEstimate {
  return value != null && WORK_EFFORT_ESTIMATE_SET.has(value);
}
