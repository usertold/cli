import { z } from 'zod';
import { TARGET_SURFACES } from '../target-surface';

export const ApiProjectSchema = z.object({
  ref: z.string(),
  handle: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  org_handle: z.string().nullable(),
  project_handle: z.string(),
  project_ref: z.string().nullable(),
  canonical_path: z.string().nullable(),
  can_manage_credits: z.boolean(),
  github_repo_url: z.string().nullable(),
  github_default_branch: z.string(),
  github_installation_id: z.string().nullable(),
  linear_team_id: z.string().nullable(),
  public_key: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiProject = z.infer<typeof ApiProjectSchema>;

export const ApiProjectsListResponseSchema = z.object({
  projects: z.array(ApiProjectSchema),
});
export type ApiProjectsListResponse = z.infer<typeof ApiProjectsListResponseSchema>;

export const ApiProjectDetailResponseSchema = z.object({
  project: ApiProjectSchema,
  current_user_org_role: z.string().nullable(),
});
export type ApiProjectDetailResponse = z.infer<typeof ApiProjectDetailResponseSchema>;

export const ApiProjectMutationResponseSchema = z.object({
  project: ApiProjectSchema,
}).meta({ id: 'ApiProjectMutationResponse' });
export type ApiProjectMutationResponse = z.infer<typeof ApiProjectMutationResponseSchema>;

export const ApiProjectSignalHealthResponseSchema = z.object({
  session_count: z.number(),
  signal_counts: z.record(z.string(), z.number()),
  signal_total: z.number(),
  signal_distribution: z.record(z.string(), z.number()),
  task_counts: z.record(z.string(), z.number()),
  task_total: z.number(),
  study_count: z.number(),
  coverage_gaps: z.array(z.string()),
});
export type ApiProjectSignalHealthResponse = z.infer<typeof ApiProjectSignalHealthResponseSchema>;

export const ApiCoverageGapTypeSchema = z.enum([
  'published_unlinked_evidence',
  'repeated_needs_review_evidence',
  'high_confidence_unlinked_evidence',
  'work_with_weak_or_no_published_evidence',
]);
export type ApiCoverageGapType = z.infer<typeof ApiCoverageGapTypeSchema>;

export const ApiCoverageGapRowSchema = z.object({
  id: z.string(),
  type: ApiCoverageGapTypeSchema,
  target_surface: z.enum(TARGET_SURFACES),
  signal_type: z.string().nullable(),
  summary: z.string(),
  count: z.number(),
  evidence_ids: z.array(z.string()),
  work_ids: z.array(z.string()),
  suggested_action: z.string(),
});
export type ApiCoverageGapRow = z.infer<typeof ApiCoverageGapRowSchema>;

export const ApiProjectCoverageGapsResponseSchema = z.object({
  gaps: z.array(ApiCoverageGapRowSchema),
  totals: z.object({
    published_unlinked_evidence: z.number(),
    repeated_needs_review_evidence: z.number(),
    high_confidence_unlinked_evidence: z.number(),
    work_with_weak_or_no_published_evidence: z.number(),
  }),
});
export type ApiProjectCoverageGapsResponse = z.infer<typeof ApiProjectCoverageGapsResponseSchema>;
