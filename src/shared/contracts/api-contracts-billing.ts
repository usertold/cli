import * as Api from '../api-types';
import {
  ApiBillingCheckoutResponseSchema,
  ApiBillingEventsResponseSchema,
  ApiBillingStatusSchema,
  ApiBillingInterviewsResponseSchema,
} from '../schemas';
import { defineContract } from './api-contracts-common';

export const billingApiContracts = {
  billingStatus: defineContract({
    method: 'GET',
    path: '/api/billing',
    pathParams: [],
    response: ApiBillingStatusSchema,
  }),
  billingEvents: defineContract({
    method: 'GET',
    path: '/api/billing/events',
    pathParams: [],
    query: Api.ApiBillingEventsQuerySchema,
    response: ApiBillingEventsResponseSchema,
  }),
  billingInterviews: defineContract({
    method: 'GET',
    path: '/api/billing/interviews',
    pathParams: [],
    query: Api.ApiBillingEventsQuerySchema,
    response: ApiBillingInterviewsResponseSchema,
  }),
  billingCheckout: defineContract({
    method: 'POST',
    path: '/api/billing/checkout',
    pathParams: [],
    body: Api.ApiBillingCheckoutRequestSchema,
    response: ApiBillingCheckoutResponseSchema,
  }),
} as const;
