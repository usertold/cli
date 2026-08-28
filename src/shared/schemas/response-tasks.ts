import { z } from 'zod';
import { ApiSignalSchema } from './response-signals';
import { TARGET_SURFACES } from '../target-surface';
import { TASK_STATUSES, TASK_STATUS_TRANSITION_SOURCES } from '../task-status';

export const ApiTaskSchema = z.object({
  id: z.string(),
  project_ref: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  target_surface: z.enum(TARGET_SURFACES),
  status: z.enum(TASK_STATUSES),
  priority_score: z.number(),
  priority_label: z.string(),
  effort_estimate: z.string().nullable(),
  signal_count: z.number(),
  session_count: z.number(),
  implementation_branch: z.string().nullable(),
  implementation_pr_url: z.string().nullable(),
  implementation_pr_number: z.number().nullable(),
  deployed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiTask = z.infer<typeof ApiTaskSchema>;

export const ApiTaskStatusHistorySchema = z.object({
  id: z.string(),
  task_id: z.string(),
  project_ref: z.string(),
  from_status: z.enum(TASK_STATUSES).nullable(),
  to_status: z.enum(TASK_STATUSES),
  source: z.enum(TASK_STATUS_TRANSITION_SOURCES),
  reason: z.string().nullable(),
  actor_id: z.string().nullable(),
  created_at: z.string(),
});
export type ApiTaskStatusHistory = z.infer<typeof ApiTaskStatusHistorySchema>;

export const ApiTaskRelatedTaskSchema = z.object({
  relation_id: z.string(),
  relation_type: z.string(),
  reason: z.string().nullable(),
  score: z.number().nullable(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  task: ApiTaskSchema,
});
export type ApiTaskRelatedTask = z.infer<typeof ApiTaskRelatedTaskSchema>;

export const ApiTaskEvidenceResolutionSchema = z.object({
  link_id: z.string(),
  linked_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolved_by_provider: z.string().nullable(),
  resolved_by_provider_issue_id: z.string().nullable(),
  resolution_reason: z.string().nullable(),
});
export type ApiTaskEvidenceResolution = z.infer<typeof ApiTaskEvidenceResolutionSchema>;

export const ApiTaskEvidenceSignalSchema = ApiSignalSchema.extend({
  evidence_resolution: ApiTaskEvidenceResolutionSchema.nullable().optional(),
});
export type ApiTaskEvidenceSignal = z.infer<typeof ApiTaskEvidenceSignalSchema>;

export const ApiTaskRecurrenceCandidateSchema = z.object({
  id: z.string(),
  project_ref: z.string(),
  new_signal_id: z.string(),
  related_task_id: z.string(),
  related_resolved_signal_id: z.string().nullable(),
  confidence: z.number(),
  reason: z.string().nullable(),
  status: z.enum(['candidate', 'confirmed', 'dismissed']),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});
export type ApiTaskRecurrenceCandidate = z.infer<typeof ApiTaskRecurrenceCandidateSchema>;

export const ApiTaskRecurrenceCandidateResponseSchema = z.object({
  recurrence_candidate: ApiTaskRecurrenceCandidateSchema,
});
export type ApiTaskRecurrenceCandidateResponse = z.infer<typeof ApiTaskRecurrenceCandidateResponseSchema>;

export const ApiProviderStateSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  project_ref: z.string(),
  provider: z.string(),
  external_id: z.string().nullable(),
  external_url: z.string().nullable(),
  external_status: z.string().nullable(),
  metadata_json: z.string().nullable(),
  synced_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiProviderState = z.infer<typeof ApiProviderStateSchema>;

export const ApiTasksListResponseSchema = z.object({
  tasks: z.array(ApiTaskSchema.extend({
    relation_count: z.number().optional(),
    provider_states: z.array(ApiProviderStateSchema).optional(),
    recurrence_candidates: z.array(ApiTaskRecurrenceCandidateSchema).optional(),
  })),
  total: z.number(),
  project_total: z.number(),
});
export type ApiTasksListResponse = z.infer<typeof ApiTasksListResponseSchema>;

export const ApiTaskDetailResponseSchema = z.object({
  task: ApiTaskSchema,
  signals: z.array(ApiTaskEvidenceSignalSchema),
  status_history: z.array(ApiTaskStatusHistorySchema).optional(),
  related_tasks: z.array(ApiTaskRelatedTaskSchema).optional(),
  recurrence_candidates: z.array(ApiTaskRecurrenceCandidateSchema).optional(),
  // The CLI transports this service-owned decision record without embedding
  // the private prioritization engine that produces it.
  work_decision_record: z.unknown().optional(),
});
export type ApiTaskDetailResponse = z.infer<typeof ApiTaskDetailResponseSchema>;

export const ApiTaskResponseSchema = z.object({
  task: ApiTaskSchema,
}).meta({ id: 'ApiTaskResponse' });
export type ApiTaskResponse = z.infer<typeof ApiTaskResponseSchema>;

export const ApiTaskProviderStateResponseSchema = z.object({
  providers: z.array(ApiProviderStateSchema),
});
export type ApiTaskProviderStateResponse = z.infer<typeof ApiTaskProviderStateResponseSchema>;

export const ApiReadyTasksResponseSchema = z.object({
  tasks: z.array(ApiTaskSchema),
});
export type ApiReadyTasksResponse = z.infer<typeof ApiReadyTasksResponseSchema>;

export const ApiTaskPushResponseSchema = z.object({
  taskId: z.string(),
  provider: z.string(),
  issueUrl: z.string().nullable(),
  issueNumber: z.string().nullable(),
  status: z.string().nullable(),
  pushed: z.boolean(),
  alreadyPushed: z.boolean(),
});
export type ApiTaskPushResponse = z.infer<typeof ApiTaskPushResponseSchema>;

export const ApiTaskCreateFromSignalsResponseSchema = z.object({
  task: ApiTaskSchema,
  linkedSignalIds: z.array(z.string()),
  priority: z.object({
    score: z.number(),
    label: z.string(),
  }),
});
export type ApiTaskCreateFromSignalsResponse = z.infer<typeof ApiTaskCreateFromSignalsResponseSchema>;
