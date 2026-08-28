import { z } from 'zod';
import { StudyInvitationSchema, StudyVisibilitySchema } from '../study-placement';

export const ApiStudySchema = z.object({
  ref: z.string(),
  handle: z.string(),
  project_ref: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  goals_json: z.string().nullable(),
  script_json: z.string().nullable(),
  settings_json: z.string().nullable(),
  invitation: StudyInvitationSchema.nullable(),
  invitation_state: z.enum(['absent', 'valid', 'invalid']),
  visibility: StudyVisibilitySchema.nullable(),
  visibility_state: z.enum(['absent', 'valid', 'invalid']),
  recruitment_url: z.string().url().nullable()
    .describe('Shareable customer-page URL for a configured direct-link Invitation; null until an allowed origin is available.'),
  allowed_selectors: z.string().nullable(),
  allowed_origins: z.string().nullable(),
  intake_ref: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiStudy = z.infer<typeof ApiStudySchema>;

export const ApiStudyActivitySchema = z.object({
  sessions: z.number(),
  new_this_week: z.number(),
  signals: z.number(),
  latest: z.string().nullable(),
});
export type ApiStudyActivity = z.infer<typeof ApiStudyActivitySchema>;

export const ApiStudyOriginGuardFailureSchema = z.object({
  session_id: z.string(),
  code: z.enum(['origin_required', 'origin_invalid', 'origin_not_allowed']),
  reason: z.string(),
  request_origin: z.string().nullable(),
  normalized_origin: z.string().nullable(),
  allowed_origins: z.array(z.string()),
  policy_source: z.string().nullable(),
  occurred_at: z.string(),
});
export type ApiStudyOriginGuardFailure = z.infer<typeof ApiStudyOriginGuardFailureSchema>;

export const ApiStudiesListResponseSchema = z.object({
  studies: z.array(ApiStudySchema),
  activity: z.record(z.string(), ApiStudyActivitySchema).optional(),
});
export type ApiStudiesListResponse = z.infer<typeof ApiStudiesListResponseSchema>;

/**
 * Authenticated placement preview result. Unlike the public SDK resolver,
 * the dashboard needs the winning Study's presentation from the same
 * project snapshot so it never combines a winner ref with stale list data.
 */
export const ApiStudyPlacementPreviewResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('match'),
    study_ref: z.string(),
    study_title: z.string(),
    invitation: StudyInvitationSchema.nullable(),
  }).strict(),
  z.object({ outcome: z.literal('no_match') }).strict(),
  z.object({
    outcome: z.literal('ambiguous'),
    reason: z.literal('configuration_ambiguous'),
    ambiguous_study_refs: z.array(z.string()).min(2).max(100),
  }).strict(),
  z.object({
    outcome: z.literal('unavailable'),
    study_ref: z.string(),
    reason: z.enum(['inactive', 'capacity_reached', 'configuration_invalid', 'runtime_unavailable']),
  }).strict(),
]).meta({ id: 'ApiStudyPlacementPreviewResponse' });
export type ApiStudyPlacementPreviewResponse = z.infer<typeof ApiStudyPlacementPreviewResponseSchema>;

export const ApiStudyResponseSchema = z.object({
  study: ApiStudySchema,
  origin_guard_failure: ApiStudyOriginGuardFailureSchema.nullable().optional(),
  intake_auto_created: z.boolean().optional(),
  intake_ref: z.string().optional(),
}).meta({ id: 'ApiStudyResponse' });
export type ApiStudyResponse = z.infer<typeof ApiStudyResponseSchema>;

export const ApiStudyUpdateResponseSchema = z.object({
  study: ApiStudySchema,
  intake_status_changed: z.boolean().optional(),
  warning: z.string().optional(),
});
export type ApiStudyUpdateResponse = z.infer<typeof ApiStudyUpdateResponseSchema>;

const StudyPlacementMutationErrorBaseSchema = z.object({
  error: z.string(),
  action: z.string(),
});

export const ApiStudyUpdateChangedResponseSchema = StudyPlacementMutationErrorBaseSchema.extend({
  code: z.literal('study_update_changed'),
  retryable: z.literal(true),
}).meta({ id: 'ApiStudyUpdateChangedResponse' });
export type ApiStudyUpdateChangedResponse = z.infer<typeof ApiStudyUpdateChangedResponseSchema>;

export const ApiStudyPlacementMutationErrorResponseSchema = z.discriminatedUnion('code', [
  StudyPlacementMutationErrorBaseSchema.extend({
    code: z.literal('study_placement_conflict'),
    conflicting_study_refs: z.array(z.string()),
    representative_context: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('pathname'),
        pathname: z.string(),
        language: z.string(),
      }),
      z.object({
        kind: z.literal('subtree_remainder'),
        pathname: z.string(),
        language: z.string(),
      }),
    ]),
  }),
  StudyPlacementMutationErrorBaseSchema.extend({
    code: z.literal('study_placement_configuration_invalid'),
    study_ref: z.string(),
    configuration: z.enum(['invitation', 'visibility']),
  }),
  StudyPlacementMutationErrorBaseSchema.extend({
    code: z.literal('study_placement_changed'),
    retryable: z.literal(true),
  }),
]).meta({ id: 'ApiStudyPlacementMutationErrorResponse' });
export type ApiStudyPlacementMutationErrorResponse = z.infer<typeof ApiStudyPlacementMutationErrorResponseSchema>;

const StudyPatchHandleConflictResponseSchema = z.object({
  error: z.string(),
}).strict();

const StudyCreateHandleConflictResponseSchema = z.object({
  error: z.string(),
  suggestion: z.string(),
}).strict();

export const ApiStudyCreateConflictResponseSchema = z.union([
  StudyCreateHandleConflictResponseSchema,
  ApiStudyUpdateChangedResponseSchema,
]).meta({ id: 'ApiStudyCreateConflictResponse' });
export type ApiStudyCreateConflictResponse = z.infer<typeof ApiStudyCreateConflictResponseSchema>;

export const ApiStudyPatchConflictResponseSchema = z.union([
  ApiStudyPlacementMutationErrorResponseSchema,
  ApiStudyUpdateChangedResponseSchema,
  StudyPatchHandleConflictResponseSchema,
]).meta({ id: 'ApiStudyPatchConflictResponse' });

const ActiveStudyDeleteForbiddenResponseSchema = z.object({
  error: z.string(),
  code: z.literal('active_study_delete_forbidden'),
  action: z.string(),
});

const StudyDeleteChangedResponseSchema = z.object({
  error: z.string(),
  code: z.literal('study_delete_changed'),
  action: z.string(),
  retryable: z.literal(true),
});

export const ApiStudyDeleteConflictResponseSchema = z.union([
  ActiveStudyDeleteForbiddenResponseSchema,
  StudyDeleteChangedResponseSchema,
]).meta({ id: 'ApiStudyDeleteConflictResponse' });
export type ApiStudyDeleteConflictResponse = z.infer<typeof ApiStudyDeleteConflictResponseSchema>;

export const ApiStudyReviewScriptResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).optional(),
  summary: z.object({
    segment_count: z.number(),
    goal_count: z.number(),
    modes: z.array(z.string()),
  }).optional(),
});
export type ApiStudyReviewScriptResponse = z.infer<typeof ApiStudyReviewScriptResponseSchema>;
