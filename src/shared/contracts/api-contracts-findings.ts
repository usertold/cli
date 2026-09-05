import { z } from 'zod';
import { WORK_EFFORT_ESTIMATES } from '../task-effort';
import { TARGET_SURFACE_FILTERS } from '../target-surface';
import { FINDING_DELIVERY_STATES, FINDING_RESEARCH_STATES } from '../finding-lifecycle';
import {
  ApiFindingCreateFromEvidenceResponseSchema,
  ApiFindingDetailResponseSchema,
  ApiFindingProviderStateResponseSchema,
  ApiFindingRecurrenceCandidateResponseSchema,
  ApiFindingResponseSchema,
  ApiFindingsListResponseSchema,
  ApiFindingSendResponseSchema,
  ApiSuccessResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const ApiFindingCreateRequestSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  priority_score: z.number().optional(),
  effort_estimate: z.enum(WORK_EFFORT_ESTIMATES).nullable().optional(),
}).strict();
export type ApiFindingCreateRequest = z.infer<typeof ApiFindingCreateRequestSchema>;

export const ApiFindingPatchRequestSchema = ApiFindingCreateRequestSchema.partial().extend({
  research_state: z.enum(FINDING_RESEARCH_STATES).optional(),
  delivery_state: z.enum(FINDING_DELIVERY_STATES).optional(),
  research_state_reason: z.string().nullable().optional(),
});
export type ApiFindingPatchRequest = z.infer<typeof ApiFindingPatchRequestSchema>;

export const ApiFindingCreateFromEvidenceRequestSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  evidence_refs: z.array(z.string()).min(1),
}).strict();
export type ApiFindingCreateFromEvidenceRequest = z.infer<typeof ApiFindingCreateFromEvidenceRequestSchema>;

export const ApiFindingRecurrenceCandidateReviewRequestSchema = z.object({
  status: z.enum(['confirmed', 'dismissed']),
}).strict();

export const ApiFindingListQuerySchema = z.object({
  research_state: z.enum(FINDING_RESEARCH_STATES).optional(),
  delivery_state: z.enum(FINDING_DELIVERY_STATES).optional(),
  include_closed: z.string().optional(),
  target_surface: z.enum(TARGET_SURFACE_FILTERS).optional(),
  evidence_interview_ref: z.string().optional(),
  min_priority: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
}).strict();

// USE-997 preserves dashboard-configured default selection when omitted or auto.
export const ApiFindingSendRequestSchema = z.object({
  provider: z.enum(['auto', 'linear', 'github']).optional(),
}).strict();

export const findingsApiContracts = {
  findingsList: defineContract({ method: 'GET', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings', pathParams: ['orgHandle', 'projectHandle'], query: ApiFindingListQuerySchema, response: ApiFindingsListResponseSchema }),
  findingCreateFromEvidence: defineContract({ method: 'POST', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings/from-evidence', pathParams: ['orgHandle', 'projectHandle'], body: ApiFindingCreateFromEvidenceRequestSchema, response: ApiFindingCreateFromEvidenceResponseSchema }),
  findingCreate: defineContract({ method: 'POST', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings', pathParams: ['orgHandle', 'projectHandle'], body: ApiFindingCreateRequestSchema, response: ApiFindingResponseSchema }),
  findingGet: defineContract({ method: 'GET', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings/:findingRef', pathParams: ['orgHandle', 'projectHandle', 'findingRef'], response: ApiFindingDetailResponseSchema }),
  findingPatch: defineContract({ method: 'PATCH', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings/:findingRef', pathParams: ['orgHandle', 'projectHandle', 'findingRef'], body: ApiFindingPatchRequestSchema, response: ApiFindingResponseSchema }),
  findingDelete: defineContract({ method: 'DELETE', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings/:findingRef', pathParams: ['orgHandle', 'projectHandle', 'findingRef'], response: ApiSuccessResponseSchema }),
  findingRecurrenceCandidateReview: defineContract({ method: 'POST', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings/:findingRef/recurrence-candidates/:candidateRef/review', pathParams: ['orgHandle', 'projectHandle', 'findingRef', 'candidateRef'], body: ApiFindingRecurrenceCandidateReviewRequestSchema, response: ApiFindingRecurrenceCandidateResponseSchema }),
  findingProviderStates: defineContract({ method: 'GET', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings/:findingRef/provider-states', pathParams: ['orgHandle', 'projectHandle', 'findingRef'], response: ApiFindingProviderStateResponseSchema }),
  findingSend: defineContract({ method: 'POST', path: '/api/orgs/:orgHandle/projects/:projectHandle/findings/:findingRef/send', pathParams: ['orgHandle', 'projectHandle', 'findingRef'], body: ApiFindingSendRequestSchema, response: ApiFindingSendResponseSchema }),
} as const;
