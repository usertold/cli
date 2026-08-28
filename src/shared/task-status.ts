export const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'done', 'wont_fix'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const CLOSED_TASK_STATUSES = ['done', 'wont_fix'] as const satisfies readonly TaskStatus[];
export const TASK_STATUS_TRANSITION_SOURCES = [
  'user',
  'mcp',
  'linear_webhook',
  'github_webhook',
  // Legacy value retained so historical status rows remain readable.
  'impact_measurement',
  'consolidation_reopen',
  'system',
] as const;
export type TaskStatusTransitionSource = (typeof TASK_STATUS_TRANSITION_SOURCES)[number];

const TASK_STATUS_SET = new Set<string>(TASK_STATUSES);
const CLOSED_TASK_STATUS_SET = new Set<string>(CLOSED_TASK_STATUSES);
const TASK_STATUS_TRANSITION_SOURCE_SET = new Set<string>(TASK_STATUS_TRANSITION_SOURCES);

export function isTaskStatus(status: string | null | undefined): status is TaskStatus {
  return status != null && TASK_STATUS_SET.has(status);
}

export function isClosedTaskStatus(status: string | null | undefined): boolean {
  return status != null && CLOSED_TASK_STATUS_SET.has(status);
}

export function isTaskStatusTransitionSource(source: string | null | undefined): source is TaskStatusTransitionSource {
  return source != null && TASK_STATUS_TRANSITION_SOURCE_SET.has(source);
}
