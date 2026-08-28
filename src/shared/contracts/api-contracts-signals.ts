import * as Api from '../api-types';
import {
  ApiSignalBulkMutationResponseSchema,
  ApiSignalResponseSchema,
  ApiSignalsListResponseSchema,
  ApiSuccessResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const signalsApiContracts = {
  sessionSignalCreate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/sessions/:sessionId/signals',
    pathParams: ['orgHandle', 'projectHandle', 'sessionId'],
    body: Api.ApiSessionSignalCreateRequestSchema,
    response: ApiSignalResponseSchema,
  }),
  signalsList: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals',
    pathParams: ['orgHandle', 'projectHandle'],
    query: Api.ApiSignalListQuerySchema,
    response: ApiSignalsListResponseSchema,
  }),
  signalGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    response: ApiSignalResponseSchema,
  }),
  signalPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    body: Api.ApiSignalPatchRequestSchema,
    response: ApiSignalResponseSchema,
  }),
  signalAnnotate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId/annotate',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    body: Api.ApiSignalAnnotateRequestSchema,
    response: ApiSignalResponseSchema,
  }),
  signalDismiss: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId/dismiss',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    body: Api.ApiSignalDismissRequestSchema,
    response: ApiSignalResponseSchema,
  }),
  signalUndismiss: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId/undismiss',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    response: ApiSignalResponseSchema,
  }),
  signalReview: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId/review',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    body: Api.ApiSignalReviewRequestSchema,
    response: ApiSignalResponseSchema,
  }),
  signalLink: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId/link',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    body: Api.ApiSignalLinkRequestSchema,
    response: ApiSuccessResponseSchema,
  }),
  signalUnlink: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId/unlink',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    response: ApiSuccessResponseSchema,
  }),
  signalDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/:signalId',
    pathParams: ['orgHandle', 'projectHandle', 'signalId'],
    response: ApiSuccessResponseSchema,
  }),
  signalsBulkLink: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signals/bulk-link',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiSignalBulkLinkRequestSchema,
    response: ApiSignalBulkMutationResponseSchema,
  }),
} as const;
