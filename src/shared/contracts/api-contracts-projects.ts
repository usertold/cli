import * as Api from '../api-types';
import {
  ApiProjectDetailResponseSchema,
  ApiProjectMutationResponseSchema,
  ApiProjectCoverageGapsResponseSchema,
  ApiProjectSignalHealthResponseSchema,
  ApiProjectsListResponseSchema,
  ApiSuccessResponseSchema,
  ApiWidgetInstallationVerificationReportSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const projectsApiContracts = {
  projectList: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects',
    pathParams: ['orgHandle'],
    response: ApiProjectsListResponseSchema,
  }),
  projectCreate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects',
    pathParams: ['orgHandle'],
    body: Api.ApiProjectCreateRequestSchema,
    response: ApiProjectMutationResponseSchema,
  }),
  projectGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiProjectDetailResponseSchema,
  }),
  projectPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiProjectPatchRequestSchema,
    response: ApiProjectMutationResponseSchema,
  }),
  projectDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiSuccessResponseSchema,
  }),
  projectSignalHealth: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/signal-health',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiProjectSignalHealthResponseSchema,
  }),
  projectCoverageGaps: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/coverage-gaps',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiProjectCoverageGapsResponseSchema,
  }),
  projectWidgetInstallationVerify: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/widget-installation/verify',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiWidgetInstallationVerificationRequestSchema,
    response: ApiWidgetInstallationVerificationReportSchema,
  }),
} as const;
