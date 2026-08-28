import * as Api from '../api-types';
import {
  ApiReadyTasksResponseSchema,
  ApiSuccessResponseSchema,
  ApiTaskCreateFromSignalsResponseSchema,
  ApiTaskDetailResponseSchema,
  ApiTaskProviderStateResponseSchema,
  ApiTaskPushResponseSchema,
  ApiTaskRecurrenceCandidateResponseSchema,
  ApiTaskResponseSchema,
  ApiTasksListResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const tasksApiContracts = {
  tasksList: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks',
    pathParams: ['orgHandle', 'projectHandle'],
    query: Api.ApiTaskListQuerySchema,
    response: ApiTasksListResponseSchema,
  }),
  tasksReady: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/ready',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiReadyTasksResponseSchema,
  }),
  taskCreateFromSignals: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/from-signals',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiTaskCreateFromSignalsRequestSchema,
    response: ApiTaskCreateFromSignalsResponseSchema,
  }),
  taskCreate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiTaskCreateRequestSchema,
    response: ApiTaskResponseSchema,
  }),
  taskGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/:taskId',
    pathParams: ['orgHandle', 'projectHandle', 'taskId'],
    response: ApiTaskDetailResponseSchema,
  }),
  taskPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/:taskId',
    pathParams: ['orgHandle', 'projectHandle', 'taskId'],
    body: Api.ApiTaskPatchRequestSchema,
    response: ApiTaskResponseSchema,
  }),
  taskDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/:taskId',
    pathParams: ['orgHandle', 'projectHandle', 'taskId'],
    response: ApiSuccessResponseSchema,
  }),
  taskRecurrenceCandidateReview: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/:taskId/recurrence-candidates/:candidateId/review',
    pathParams: ['orgHandle', 'projectHandle', 'taskId', 'candidateId'],
    body: Api.ApiTaskRecurrenceCandidateReviewRequestSchema,
    response: ApiTaskRecurrenceCandidateResponseSchema,
  }),
  taskProviderState: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/:taskId/provider-state',
    pathParams: ['orgHandle', 'projectHandle', 'taskId'],
    response: ApiTaskProviderStateResponseSchema,
  }),
  taskPush: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/:taskId/push',
    pathParams: ['orgHandle', 'projectHandle', 'taskId'],
    response: ApiTaskPushResponseSchema,
  }),
  linearTaskPush: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/tasks/:taskId/push/linear',
    pathParams: ['orgHandle', 'projectHandle', 'taskId'],
    response: ApiTaskPushResponseSchema,
  }),
} as const;
