import { z } from 'zod';

export const ApiWidgetInstallationCheckSchema = z.object({
  id: z.string(),
  category: z.enum([
    'page',
    'widget',
    'csp',
    'permissions_policy',
  ]),
  status: z.enum(['pass', 'warning', 'fail']),
  title: z.string(),
  message: z.string(),
  observed: z.union([z.string(), z.array(z.string())]).optional(),
  expected: z.string().optional(),
  recommendation: z.string().optional(),
  remediation_snippet: z.string().optional(),
});
export type ApiWidgetInstallationCheck = z.infer<typeof ApiWidgetInstallationCheckSchema>;

export const ApiWidgetInstallationVerificationReportSchema = z.object({
  project_ref: z.string(),
  requested_url: z.string(),
  final_url: z.string().nullable(),
  verified_at: z.string(),
  overall_status: z.enum(['pass', 'warning', 'fail']),
  summary: z.object({
    passed: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  fetch: z.object({
    http_status: z.number().int().nullable(),
    redirects: z.array(z.object({
      from: z.string(),
      to: z.string(),
      status: z.number().int(),
    })),
  }),
  checks: z.array(ApiWidgetInstallationCheckSchema),
});
export type ApiWidgetInstallationVerificationReport = z.infer<
  typeof ApiWidgetInstallationVerificationReportSchema
>;

// Response naming keeps the contract discoverable alongside the other API
// response schemas while Report names the value shared by HTTP, CLI, and MCP.
export const ApiWidgetInstallationVerificationResponseSchema =
  ApiWidgetInstallationVerificationReportSchema;
export type ApiWidgetInstallationVerificationResponse =
  ApiWidgetInstallationVerificationReport;
