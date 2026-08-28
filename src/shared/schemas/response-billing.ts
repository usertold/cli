import { z } from 'zod';
import { BILLING_EVENT_AMOUNT_DIRECTIONS, BILLING_EVENT_DISPLAY_KINDS } from '../billing-events';

export const ApiBillingEventSchema = z.object({
  id: z.string(),
  user_id: z.number(),
  session_id: z.string().nullable(),
  project_ref: z.string().nullable(),
  event_type: z.string(),
  display_label: z.string(),
  display_kind: z.enum(BILLING_EVENT_DISPLAY_KINDS),
  amount_direction: z.enum(BILLING_EVENT_AMOUNT_DIRECTIONS),
  balance_delta_cents: z.number(),
  signed_amount_cents: z.number(),
  external_reference: z.string().nullable(),
  created_at: z.string(),
});
export type ApiBillingEvent = z.infer<typeof ApiBillingEventSchema>;

export const ApiBillingProjectModeSchema = z.object({
  project_ref: z.string().nullable(),
  project_name: z.string(),
  project_handle: z.string(),
  org_handle: z.string().nullable(),
  canonical_path: z.string().nullable(),
  billing_mode: z.enum(['managed', 'byok']),
});
export type ApiBillingProjectMode = z.infer<typeof ApiBillingProjectModeSchema>;

export const ApiBillingStatusSchema = z.object({
  prepaid_balance_cents: z.number(),
  ledger_balance_cents: z.number(),
  reconciliation_difference_cents: z.number(),
  ledger_reconciled: z.boolean(),
  managed_rate_cents_per_minute: z.number(),
  byok_rate_cents_per_minute: z.number(),
  has_payment_method: z.boolean(),
  billed_interview_count: z.number(),
  gross_interview_charges_cents: z.number(),
  interview_refunds_cents: z.number(),
  net_interview_charges_cents: z.number(),
  polar_configured: z.boolean(),
  project_billing_modes: z.array(ApiBillingProjectModeSchema),
});
export type ApiBillingStatus = z.infer<typeof ApiBillingStatusSchema>;

export const ApiBillingEventsResponseSchema = z.object({
  events: z.array(ApiBillingEventSchema),
  total: z.number(),
});
export type ApiBillingEventsResponse = z.infer<typeof ApiBillingEventsResponseSchema>;

export const ApiBillingCheckoutResponseSchema = z.object({
  url: z.string(),
});
export type ApiBillingCheckoutResponse = z.infer<typeof ApiBillingCheckoutResponseSchema>;

export const ApiBillingInterviewSchema = z.object({
  session_id: z.string(),
  project_ref: z.string().nullable(),
  billing_mode: z.enum(['managed', 'byok']),
  duration_seconds: z.number().nullable(),
  billable_seconds: z.number().nullable(),
  rate_cents_per_minute: z.number(),
  minimum_charge_cents: z.number(),
  subtotal_cents: z.number().nullable(),
  charge_cents: z.number().nullable(),
  refund_cents: z.number().nullable(),
  minimum_adjustment_cents: z.number().nullable(),
  net_charge_cents: z.number().nullable(),
  status: z.enum(['pending', 'charged', 'refunded', 'excluded']),
  exclusion_reason: z.enum(['abandoned', 'error', 'missing_transcript', 'missing_duration']).nullable(),
  quoted_at: z.string(),
  charged_at: z.string().nullable(),
});
export type ApiBillingInterview = z.infer<typeof ApiBillingInterviewSchema>;

export const ApiBillingInterviewsResponseSchema = z.object({
  interviews: z.array(ApiBillingInterviewSchema),
  total: z.number(),
});
export type ApiBillingInterviewsResponse = z.infer<typeof ApiBillingInterviewsResponseSchema>;
