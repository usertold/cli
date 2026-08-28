import * as Api from '../api-types';
import {
  ApiKnowledgeActionResponseSchema,
  ApiKnowledgeActionTestResponseSchema,
  ApiProjectSettingsResponseSchema,
  ApiProjectSettingsKeyHealthResponseSchema,
  ApiValidationResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const settingsApiContracts = {
  settingsGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiProjectSettingsResponseSchema,
  }),
  settingsPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiProjectSettingsUpdateRequestSchema,
    response: ApiProjectSettingsResponseSchema,
  }),
  settingsValidate: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings/validate',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiProjectSettingsValidateRequestSchema,
    response: ApiValidationResponseSchema,
  }),
  settingsKeyHealth: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings/key-health',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiProjectSettingsKeyHealthResponseSchema,
  }),
  knowledgeActionGet: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings/knowledge-action',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiKnowledgeActionResponseSchema,
  }),
  knowledgeActionPatch: defineContract({
    method: 'PATCH',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings/knowledge-action',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiKnowledgeActionConfigInputSchema,
    response: ApiKnowledgeActionResponseSchema,
  }),
  knowledgeActionDelete: defineContract({
    method: 'DELETE',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings/knowledge-action',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiKnowledgeActionResponseSchema,
  }),
  knowledgeActionTest: defineContract({
    method: 'POST',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/settings/knowledge-action/test',
    pathParams: ['orgHandle', 'projectHandle'],
    body: Api.ApiKnowledgeActionTestRequestSchema,
    response: ApiKnowledgeActionTestResponseSchema,
  }),
} as const;
