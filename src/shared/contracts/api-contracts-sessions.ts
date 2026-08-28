import { z } from 'zod';
import * as Api from '../api-types';
import {
  ApiEnrichedTimelineEntrySchema,
  ApiProcessingStatusSchema,
  ApiSessionDetailResponseSchema,
  ApiSessionMutationResponseSchema,
  ApiSessionReprocessResponseSchema,
  ApiSessionUploadVideoResponseSchema,
  ApiMediaUploadInitiateResponseSchema,
  ApiMediaUploadPartUrlResponseSchema,
  ApiSessionsListResponseSchema,
  ApiSuccessResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';
import {
  MediaUploadCompleteRequestSchema,
  MediaUploadInitiateRequestSchema,
  MediaUploadPartUrlRequestSchema,
} from '../media-processing-contract';

const ApiSessionMediaFullQuerySchema = z.object({
  generation: z.string().regex(/^\d+$/).optional(),
});

export const sessionsApiContracts = {
  sessionsList: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions',
    pathParams: ['orgHandle', 'projectHandle'],
    query: Api.ApiSessionListQuerySchema,
    response: ApiSessionsListResponseSchema,
  }),
  sessionCreate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiSessionCreateRequestSchema,
    response: ApiSessionMutationResponseSchema,
  }),
  sessionUploadVideo: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/upload-video',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiSessionUploadVideoResponseSchema,
  }),
  mediaUploadInitiate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/media-uploads',
    pathParams: ['orgHandle', 'projectHandle'],
    body: MediaUploadInitiateRequestSchema,
    response: ApiMediaUploadInitiateResponseSchema,
  }),
  mediaUploadPartUrl: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/media-upload/part-url',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    body: MediaUploadPartUrlRequestSchema,
    response: ApiMediaUploadPartUrlResponseSchema,
  }),
  mediaUploadComplete: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/media-upload/complete',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    body: MediaUploadCompleteRequestSchema,
    response: ApiSessionUploadVideoResponseSchema,
  }),
  sessionImportTranscript: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/import-transcript',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiSessionUploadVideoResponseSchema,
  }),
  sessionGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    response: ApiSessionDetailResponseSchema,
  }),
  sessionPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    body: Api.ApiSessionPatchRequestSchema,
    response: ApiSessionMutationResponseSchema,
  }),
  sessionDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    response: ApiSuccessResponseSchema,
  }),
  sessionReprocess: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/reprocess',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    query: Api.ApiSessionReprocessQuerySchema,
    response: ApiSessionReprocessResponseSchema,
  }),
  sessionGetProcessing: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/processing',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    response: ApiProcessingStatusSchema,
  }),
  sessionMediaScreenFull: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/media/screen/full',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    query: ApiSessionMediaFullQuerySchema,
    response: z.unknown(),
  }),
  sessionMediaAudioFull: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/media/audio/full',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    query: ApiSessionMediaFullQuerySchema,
    response: z.unknown(),
  }),
  sessionTranscript: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/transcript',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    response: z.unknown(),
  }),
  sessionTimeline: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/timeline',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    response: z.unknown(),
  }),
  sessionEnrichedTimeline: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/enriched-timeline',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    response: z.array(ApiEnrichedTimelineEntrySchema),
  }),
} as const;
