import { z } from 'zod';
import { ApiProjectSchema } from './response-projects';

export const ApiSettingsWarningSchema = z.object({
  section: z.enum(['api_keys']),
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  action: z.string().optional(),
});
export type ApiSettingsWarning = z.infer<typeof ApiSettingsWarningSchema>;

export const ApiProjectSettingsResponseSchema = z.object({
  settings: z.record(z.string(), z.string()),
  warnings: z.array(ApiSettingsWarningSchema).optional(),
}).meta({ id: 'ApiProjectSettingsResponse' });
export type ApiProjectSettingsResponse = z.infer<typeof ApiProjectSettingsResponseSchema>;

export const ApiKnowledgeActionConfigSchema = z.object({
  name: z.string(),
  when_to_use: z.string(),
  method: z.enum(['GET', 'POST']),
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  response_path: z.string().nullable().optional(),
});
export type ApiKnowledgeActionConfig = z.infer<typeof ApiKnowledgeActionConfigSchema>;

export const ApiKnowledgeActionResponseSchema = z.object({
  action: ApiKnowledgeActionConfigSchema.nullable(),
});
export type ApiKnowledgeActionResponse = z.infer<typeof ApiKnowledgeActionResponseSchema>;

export const ApiKnowledgeActionTestResponseSchema = z.object({
  status: z.enum(['ok', 'not_found', 'auth_required', 'unavailable']),
  message: z.string().optional(),
  request: z.object({
    method: z.enum(['GET', 'POST']),
    url: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.unknown().optional(),
  }),
  http_status: z.number().int().optional(),
  raw_response: z.string().optional(),
  extracted_response: z.unknown().optional(),
});
export type ApiKnowledgeActionTestResponse = z.infer<typeof ApiKnowledgeActionTestResponseSchema>;

export const ApiKeyHealthStatusSchema = z.object({
  status: z.enum(['ok', 'warning', 'error', 'unknown']),
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  action: z.string().optional(),
  checked_at: z.string(),
  remaining_balance_usd: z.number().optional(),
});
export type ApiKeyHealthStatus = z.infer<typeof ApiKeyHealthStatusSchema>;

export const ApiProjectSettingsKeyHealthResponseSchema = z.object({
  key_health: z.object({
    openai_api_key: ApiKeyHealthStatusSchema.nullable(),
  }),
});
export type ApiProjectSettingsKeyHealthResponse = z.infer<typeof ApiProjectSettingsKeyHealthResponseSchema>;

export const ApiValidationResponseSchema = z.object({
  valid: z.boolean(),
  error: z.string().optional(),
});
export type ApiValidationResponse = z.infer<typeof ApiValidationResponseSchema>;

export const ApiGitHubRepoSchema = z.object({
  id: z.number().int(),
  full_name: z.string(),
  html_url: z.string(),
  default_branch: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
});
export type ApiGitHubRepo = z.infer<typeof ApiGitHubRepoSchema>;

export const ApiGitHubReposResponseSchema = z.object({
  repos: z.array(ApiGitHubRepoSchema),
  hasMore: z.boolean(),
});
export type ApiGitHubReposResponse = z.infer<typeof ApiGitHubReposResponseSchema>;

export const ApiGitHubSelectRepoResponseSchema = z.object({
  success: z.boolean(),
  project: ApiProjectSchema,
});
export type ApiGitHubSelectRepoResponse = z.infer<typeof ApiGitHubSelectRepoResponseSchema>;

export const ApiGitHubHealthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  action: z.string().optional(),
  checked_at: z.string(),
  request_id: z.string().nullable(),
});
export type ApiGitHubHealthResponse = z.infer<typeof ApiGitHubHealthResponseSchema>;

export const ApiGitHubIntegrationAuditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  outcome: z.enum(['succeeded', 'failed', 'ignored']),
  source: z.enum(['api', 'setup_callback', 'webhook']),
  actor_user_id: z.number().int().nullable(),
  installation_id: z.number().int().nullable(),
  installation_record_id: z.string().nullable(),
  repository: z.string().nullable(),
  error_code: z.string().nullable(),
  provider_status: z.number().int().nullable(),
  request_id: z.string().nullable(),
  delivery_id: z.string().nullable(),
  created_at: z.string(),
});

export const ApiGitHubAuditEventsResponseSchema = z.object({
  events: z.array(ApiGitHubIntegrationAuditEventSchema),
  next_cursor: z.string().nullable(),
  retention_days: z.number().int(),
});

export const ApiGitHubInstallationStatusSchema = z.object({
  id: z.string(),
  installation_id: z.number().int(),
  account_login: z.string(),
  account_type: z.string(),
  repository_selection: z.string(),
  permissions: z.record(z.string(), z.string()),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ApiGitHubInstallationsResponseSchema = z.object({
  installations: z.array(ApiGitHubInstallationStatusSchema),
});

export const ApiAdminGitHubAuditEventsResponseSchema = ApiGitHubAuditEventsResponseSchema.extend({
  installations: z.array(ApiGitHubInstallationStatusSchema),
});

export const ApiGitHubDiagnosticsResponseSchema = ApiGitHubAuditEventsResponseSchema.extend({
  installation: ApiGitHubInstallationStatusSchema.nullable(),
  project_repository: z.object({
    repository_id: z.number().int().nullable(),
    url: z.string(),
    default_branch: z.string(),
  }).nullable(),
});
