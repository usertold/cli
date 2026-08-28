import { ApiOverviewResponseSchema } from '../schemas';
import { defineContract } from './api-contracts-common';

export const overviewApiContracts = {
  overview: defineContract({
    method: 'GET',
    path: '/api/orgs/:orgHandle/projects/:projectHandle/overview',
    pathParams: ['orgHandle', 'projectHandle'],
    response: ApiOverviewResponseSchema,
  }),
} as const;
