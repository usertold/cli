import * as Api from '../api-types';
import { z } from 'zod';
import {
  ApiUserProfileSchema,
  ApiUserProfileUpdateResponseSchema,
  ApiEmailNotificationPreferencesSchema,
} from '../schemas/response-auth';
import { defineContract } from './api-contracts-common';

const ApiUserLastVisitedOrgResponseSchema = z.object({
  success: z.literal(true),
});

const ApiUserAccountDeleteResponseSchema = z.object({
  success: z.literal(true),
});

export const userApiContracts = {
  userProfileGet: defineContract({
    method: 'GET',
    path: '/api/user/profile',
    pathParams: [],
    response: ApiUserProfileSchema,
  }),
  userProfileUpdate: defineContract({
    method: 'PATCH',
    path: '/api/user/profile',
    pathParams: [],
    body: Api.ApiUserProfileUpdateRequestSchema,
    response: ApiUserProfileUpdateResponseSchema,
  }),
  userEmailNotificationPreferencesGet: defineContract({
    method: 'GET',
    path: '/api/user/email-notifications',
    pathParams: [],
    response: ApiEmailNotificationPreferencesSchema,
  }),
  userEmailNotificationPreferencesUpdate: defineContract({
    method: 'PATCH',
    path: '/api/user/email-notifications',
    pathParams: [],
    body: Api.ApiEmailNotificationPreferencesUpdateRequestSchema,
    response: ApiEmailNotificationPreferencesSchema,
  }),
  userLastVisitedOrg: defineContract({
    method: 'POST',
    path: '/api/users/me/last-visited-org',
    pathParams: [],
    body: Api.ApiUserLastVisitedOrgRequestSchema,
    response: ApiUserLastVisitedOrgResponseSchema,
  }),
  userAccountDelete: defineContract({
    method: 'DELETE',
    path: '/api/user/account',
    pathParams: [],
    response: ApiUserAccountDeleteResponseSchema,
  }),
} as const;
