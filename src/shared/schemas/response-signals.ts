import { z } from 'zod';
import { evidenceCaseFileV1Schema } from '../evidence-case-file-v1';
import { pipelineV1EvidenceCardArtifactSchema } from '../pipeline-v1-contract';
import { TARGET_SURFACES } from '../target-surface';
import { TASK_STATUSES } from '../task-status';

export const ApiSignalLinkedTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(TASK_STATUSES),
  linear_issue_id: z.string().nullable().optional(),
  linear_issue_url: z.string().nullable().optional(),
  linear_issue_status: z.string().nullable().optional(),
});
export type ApiSignalLinkedTask = z.infer<typeof ApiSignalLinkedTaskSchema>;

export const ApiSignalEvidenceResolutionSchema = z.object({
  link_id: z.string(),
  task_id: z.string().optional(),
  linked_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolved_by_provider: z.string().nullable(),
  resolved_by_provider_issue_id: z.string().nullable(),
  resolution_reason: z.string().nullable(),
});
export type ApiSignalEvidenceResolution = z.infer<typeof ApiSignalEvidenceResolutionSchema>;

export const ApiSignalRecurrenceCandidateSchema = z.object({
  id: z.string(),
  related_task_id: z.string(),
  related_resolved_signal_id: z.string().nullable(),
  confidence: z.number(),
  reason: z.string().nullable(),
  status: z.enum(['candidate', 'confirmed', 'dismissed']),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
  related_task: z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(TASK_STATUSES),
  }).nullable().optional(),
});
export type ApiSignalRecurrenceCandidate = z.infer<typeof ApiSignalRecurrenceCandidateSchema>;

// Provenance — the chain of custody that makes an evidence card an
// authoritative source: which study revealed it, which interview (and
// participant) it came from, the page it was said on, and the moment in
// the recording. Joined onto the signal from sessions/studies; optional so
// responses assembled without the join still validate.
export const ApiSignalProvenanceSchema = z.object({
  study: z.object({ ref: z.string(), handle: z.string(), title: z.string() }).nullable(),
  interview: z.object({
    id: z.string(),
    participant_name: z.string().nullable(),
    started_at: z.string().nullable(),
    interview_mode: z.string().nullable(),
    duration_seconds: z.number().nullable(),
  }).nullable(),
  page: z.object({ url: z.string().nullable(), title: z.string().nullable() }).nullable(),
  timestamp_ms: z.number().nullable(),
  source: z.string().nullable(),
});
export type ApiSignalProvenance = z.infer<typeof ApiSignalProvenanceSchema>;

const ApiEvidenceCaseFileSchema = evidenceCaseFileV1Schema.extend({
  evidence_card: pipelineV1EvidenceCardArtifactSchema
    .omit({ project_id: true })
    .extend({ project_ref: z.string().optional() }),
});

export const ApiSignalSchema = z.object({
  id: z.string(),
  project_ref: z.string(),
  session_id: z.string(),
  signal_type: z.string(),
  target_surface: z.enum(TARGET_SURFACES),
  confidence: z.number(),
  intensity: z.number().nullable(),
  quote: z.string(),
  timestamp_ms: z.number().nullable(),
  segment_id: z.string().nullable(),
  page_url: z.string().nullable(),
  page_title: z.string().nullable(),
  preceding_actions: z.string().nullable(),
  user_goal: z.string().nullable(),
  outcome: z.string().nullable(),
  headline: z.string().nullable().optional(),
  claim: z.string().nullable().optional(),
  reconstruction: z.string().nullable().optional(),
  observed_facts_json: z.string().nullable().optional(),
  evidence_grade: z.string().nullable().optional(),
  window_start_ms: z.number().nullable().optional(),
  window_end_ms: z.number().nullable().optional(),
  transcript_uncertain: z.boolean(),
  transcript_uncertainty_note: z.string().nullable(),
  review_status: z.string().nullable().optional(),
  review_note: z.string().nullable().optional(),
  annotation_text: z.string().nullable(),
  annotation_by: z.string().nullable(),
  annotation_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
  dismissed_reason: z.string().nullable(),
  dismissed_by: z.string().nullable(),
  source: z.string().nullable(),
  created_at: z.string(),
  linked_task: ApiSignalLinkedTaskSchema.nullable().optional(),
  evidence_resolution: ApiSignalEvidenceResolutionSchema.nullable().optional(),
  recurrence_candidates: z.array(ApiSignalRecurrenceCandidateSchema).optional(),
  provenance: ApiSignalProvenanceSchema.nullable().optional(),
  case_file: ApiEvidenceCaseFileSchema.nullable().optional(),
});
export type ApiSignal = z.infer<typeof ApiSignalSchema>;

export const ApiSignalsListResponseSchema = z.object({
  signals: z.array(ApiSignalSchema),
  total: z.number(),
  project_total: z.number(),
  inbox_counts: z.object({
    active: z.number(),
    needs_review: z.number(),
    active_linked: z.number(),
    active_unlinked: z.number(),
    possible_recurrence: z.number(),
    resolved: z.number(),
  }).optional(),
});
export type ApiSignalsListResponse = z.infer<typeof ApiSignalsListResponseSchema>;

export const ApiSignalResponseSchema = z.object({
  signal: ApiSignalSchema,
}).meta({ id: 'ApiSignalResponse' });
export type ApiSignalResponse = z.infer<typeof ApiSignalResponseSchema>;

export const ApiSignalBulkMutationErrorSchema = z.object({
  signal_id: z.string(),
  error: z.string(),
});
export type ApiSignalBulkMutationError = z.infer<typeof ApiSignalBulkMutationErrorSchema>;

export const ApiSignalBulkMutationResponseSchema = z.object({
  processed: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  task_id: z.string().optional(),
  errors: z.array(ApiSignalBulkMutationErrorSchema),
});
export type ApiSignalBulkMutationResponse = z.infer<typeof ApiSignalBulkMutationResponseSchema>;
