import { z } from 'zod';
import { FINDING_DELIVERY_STATES, FINDING_RESEARCH_STATES, LINEAR_PROVIDER_PLACEMENTS } from '../finding-lifecycle';
import { TARGET_SURFACES } from '../target-surface';
import { TASK_STATUS_TRANSITION_SOURCES } from '../task-status';
import { ApiSignalSchema } from './response-signals';

export const ApiFindingSchema = z.object({
  finding_ref: z.string(),
  project_ref: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  target_surface: z.enum(TARGET_SURFACES),
  research_state: z.enum(FINDING_RESEARCH_STATES),
  delivery_state: z.enum(FINDING_DELIVERY_STATES).nullable(),
  provider_placement: z.enum(LINEAR_PROVIDER_PLACEMENTS).nullable(),
  priority_score: z.number(),
  priority_label: z.string(),
  effort_estimate: z.string().nullable(),
  evidence_count: z.number(),
  interview_count: z.number(),
  implementation_branch: z.string().nullable(),
  implementation_pr_url: z.string().nullable(),
  implementation_pr_number: z.number().nullable(),
  deployed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiFinding = z.infer<typeof ApiFindingSchema>;

export const ApiFindingLifecycleHistorySchema = z.object({
  id: z.string(),
  finding_ref: z.string(),
  project_ref: z.string(),
  from_research_state: z.enum(FINDING_RESEARCH_STATES).nullable(),
  to_research_state: z.enum(FINDING_RESEARCH_STATES),
  from_delivery_state: z.enum(FINDING_DELIVERY_STATES).nullable(),
  to_delivery_state: z.enum(FINDING_DELIVERY_STATES),
  source: z.enum(TASK_STATUS_TRANSITION_SOURCES),
  reason: z.string().nullable(),
  actor_id: z.string().nullable(),
  created_at: z.string(),
});

export const ApiFindingRelationSchema = z.object({
  relation_ref: z.string(),
  relation_type: z.string(),
  reason: z.string().nullable(),
  score: z.number().nullable(),
  source: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  finding: ApiFindingSchema,
});

export const ApiFindingEvidenceResolutionSchema = z.object({
  link_ref: z.string(),
  linked_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolved_by_provider: z.string().nullable(),
  resolved_by_provider_issue_id: z.string().nullable(),
  resolution_reason: z.string().nullable(),
});

export const ApiFindingEvidenceSchema = ApiSignalSchema.omit({
  id: true,
  session_id: true,
  signal_type: true,
  linked_task: true,
  evidence_resolution: true,
  recurrence_candidates: true,
  case_file: true,
}).extend({
  evidence_ref: z.string(),
  interview_ref: z.string(),
  evidence_type: z.string(),
  evidence_resolution: ApiFindingEvidenceResolutionSchema.nullable().optional(),
});

export const ApiFindingRecurrenceCandidateSchema = z.object({
  candidate_ref: z.string(),
  project_ref: z.string(),
  new_evidence_ref: z.string(),
  related_finding_ref: z.string(),
  related_resolved_evidence_ref: z.string().nullable(),
  confidence: z.number(),
  reason: z.string().nullable(),
  status: z.enum(['candidate', 'confirmed', 'dismissed']),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});

// Provider metadata is service-owned and intentionally transported verbatim.
export const ApiFindingProviderStateSchema = z.object({
  provider: z.enum(['linear', 'github', 'usertold_linear']),
}).passthrough();

export const ApiFindingsListResponseSchema = z.object({
  findings: z.array(ApiFindingSchema.extend({
    relation_count: z.number().optional(),
    provider_states: z.array(ApiFindingProviderStateSchema).optional(),
    recurrence_candidates: z.array(ApiFindingRecurrenceCandidateSchema).optional(),
  })),
  total: z.number(),
  project_total: z.number(),
});

export const ApiFindingDetailResponseSchema = z.object({
  finding: ApiFindingSchema,
  evidence: z.array(ApiFindingEvidenceSchema),
  lifecycle_history: z.array(ApiFindingLifecycleHistorySchema).optional(),
  relations: z.array(ApiFindingRelationSchema).optional(),
  recurrence_candidates: z.array(ApiFindingRecurrenceCandidateSchema).optional(),
  decision_record: z.unknown().optional(),
});

export const ApiFindingResponseSchema = z.object({ finding: ApiFindingSchema });
export const ApiFindingProviderStateResponseSchema = z.object({
  provider_states: z.array(ApiFindingProviderStateSchema),
});
export const ApiFindingRecurrenceCandidateResponseSchema = z.object({
  recurrence_candidate: ApiFindingRecurrenceCandidateSchema,
});
export const ApiFindingSendResponseSchema = z.object({
  findingRef: z.string(),
  provider: z.enum(['linear', 'github']),
  issueUrl: z.string().nullable(),
  issueIdentifier: z.string().nullable(),
  status: z.string().nullable(),
  sent: z.boolean(),
  alreadySent: z.boolean(),
  provider_placement: z.enum(LINEAR_PROVIDER_PLACEMENTS).nullable(),
  delivery_state: z.enum(FINDING_DELIVERY_STATES),
});
export const ApiFindingCreateFromEvidenceResponseSchema = z.object({
  finding: ApiFindingSchema,
  linkedEvidenceRefs: z.array(z.string()),
  priority: z.object({ score: z.number(), label: z.string() }),
});

export type ApiFindingsListResponse = z.infer<typeof ApiFindingsListResponseSchema>;
export type ApiFindingDetailResponse = z.infer<typeof ApiFindingDetailResponseSchema>;
export type ApiFindingResponse = z.infer<typeof ApiFindingResponseSchema>;
export type ApiFindingSendResponse = z.infer<typeof ApiFindingSendResponseSchema>;
