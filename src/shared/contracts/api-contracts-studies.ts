import * as Api from '../api-types';
import {
  ApiStudiesListResponseSchema,
  ApiStudyDeleteConflictResponseSchema,
  ApiStudyCreateConflictResponseSchema,
  ApiStudyPlacementPreviewResponseSchema,
  ApiStudyReviewScriptResponseSchema,
  ApiStudyPatchConflictResponseSchema,
  ApiStudyResponseSchema,
  ApiStudyUpdateResponseSchema,
  ApiSuccessResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const studiesApiContracts = {
  studyPlacementPreview: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/studies/resolve-preview',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiStudyPlacementPreviewRequestSchema,
    response: ApiStudyPlacementPreviewResponseSchema,
  }),
  studiesList: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/studies',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiStudiesListResponseSchema,
  }),
  studyCreate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/studies',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiStudyCreateRequestSchema,
    response: ApiStudyResponseSchema,
    responses: {
      409: {
        description: 'Study handle conflict or concurrent managed Intake linking change',
        schema: ApiStudyCreateConflictResponseSchema,
      },
    },
  }),
  studyGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/studies/:studyHandle',
    pathParams: ['orgHandle', 'projectHandle', 'studyHandle'],
    response: ApiStudyResponseSchema,
  }),
  studyPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/studies/:studyHandle',
    pathParams: ['orgHandle', 'projectHandle', 'studyHandle'],
    body: Api.ApiStudyPatchRequestSchema,
    response: ApiStudyUpdateResponseSchema,
    responses: {
      409: {
        description: 'Study update conflicts with project widget placement or concurrent configuration',
        schema: ApiStudyPatchConflictResponseSchema,
      },
    },
  }),
  studyDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/studies/:studyHandle',
    pathParams: ['orgHandle', 'projectHandle', 'studyHandle'],
    response: ApiSuccessResponseSchema,
    responses: {
      409: {
        description: 'The Study is active or changed concurrently before deletion',
        schema: ApiStudyDeleteConflictResponseSchema,
      },
    },
  }),
  studyReviewScript: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/studies/:studyHandle/review-script',
    pathParams: ['orgHandle', 'projectHandle', 'studyHandle'],
    body: Api.ApiStudyReviewScriptRequestSchema,
    response: ApiStudyReviewScriptResponseSchema,
  }),
} as const;
