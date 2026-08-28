import { z } from 'zod';
import { ACCOUNT_CAPABILITY_KEYS } from '../account-capabilities';
import { CONNECTED_AUTH_PROVIDERS } from '../auth-providers';

const ApiAccountCapabilitiesSchema = z.object(Object.fromEntries(
  ACCOUNT_CAPABILITY_KEYS.map((key) => [key, z.boolean()]),
) as Record<(typeof ACCOUNT_CAPABILITY_KEYS)[number], z.ZodBoolean>);

export const ApiAuthSessionUserSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  google_id: z.string().nullable(),
  github_id: z.string().nullable(),
  connected_auth_providers: z.array(z.enum(CONNECTED_AUTH_PROVIDERS)),
  personal_org_handle: z.string().nullable(),
  last_visited_org_handle: z.string().nullable(),
  personal_org_name: z.string().nullable(),
  terms_accepted_version: z.string().nullable(),
  terms_accepted_at: z.string().nullable(),
  personal_org_reviewed_at: z.string().nullable(),
  needs_onboarding: z.boolean(),
  needs_terms_acceptance: z.boolean(),
  // True when the user's accepted version is valid for the blocking gate but
  // older than ACTIVE_TERMS_VERSION — drives the dismissible terms-update
  // notice instead of forced re-acceptance.
  terms_update_available: z.boolean(),
  needs_org_handle_review: z.boolean(),
  gpc_opt_out_at: z.string().nullable(),
  // Whether this session is treated as admin by the backend. Derived from
  // either `scope: admin` on the access token or membership in the
  // `ADMIN_USER_EMAILS` operator allowlist. Frontend route loaders consume
  // this to gate admin-only pages before render.
  is_admin: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  account_state: z.enum(['provisional', 'active', 'reclaimed']),
  email_verified_at: z.string().nullable(),
  capabilities: ApiAccountCapabilitiesSchema,
});
export type ApiAuthSessionUser = z.infer<typeof ApiAuthSessionUserSchema>;

export const ApiUserProfileSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  personal_org_handle: z.string().nullable(),
});
export type ApiUserProfile = z.infer<typeof ApiUserProfileSchema>;

export const ApiUserProfileUpdateResponseSchema = z.object({
  success: z.boolean(),
  user: ApiUserProfileSchema,
});
export type ApiUserProfileUpdateResponse = z.infer<typeof ApiUserProfileUpdateResponseSchema>;

export const ApiEmailNotificationPreferencesSchema = z.object({
  research: z.boolean(),
  credits: z.boolean(),
  integrations: z.boolean(),
  required: z.array(z.enum(['account_security', 'billing_receipts', 'legal_notices'])),
});
export type ApiEmailNotificationPreferences = z.infer<typeof ApiEmailNotificationPreferencesSchema>;

export const ApiAuthSessionResponseSchema = z.object({
  user: ApiAuthSessionUserSchema.nullable(),
  config: z.object({
    googleClientId: z.string(),
    githubClientId: z.string(),
    linearClientId: z.string().optional(),
    environment: z.string(),
    passwordAuthEnabled: z.boolean(),
    passwordRegistrationEnabled: z.boolean(),
    turnstileSiteKey: z.string(),
  }),
});
export type ApiAuthSessionResponse = z.infer<typeof ApiAuthSessionResponseSchema>;

export const ApiAuthLogoutResponseSchema = z.object({
  success: z.boolean(),
});
export type ApiAuthLogoutResponse = z.infer<typeof ApiAuthLogoutResponseSchema>;

export const ApiAuthOnboardingCompleteResponseSchema = z.object({
  success: z.literal(true),
  user: ApiAuthSessionUserSchema.nullable(),
});
export type ApiAuthOnboardingCompleteResponse = z.infer<typeof ApiAuthOnboardingCompleteResponseSchema>;

export const ApiAuthRevokeOlderSessionsResponseSchema = z.object({
  success: z.literal(true),
  session_tokens_valid_after: z.number(),
});
export type ApiAuthRevokeOlderSessionsResponse = z.infer<typeof ApiAuthRevokeOlderSessionsResponseSchema>;

export const ApiOAuthGrantSchema = z.object({
  id: z.string(),
  accountId: z.number(),
  workspaceId: z.string().nullable(),
  clientId: z.string(),
  clientName: z.string(),
  scopes: z.array(z.string()),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  revokedAt: z.string().nullable(),
  revocationReason: z.string().nullable(),
});
export const ApiOAuthGrantListResponseSchema = z.object({ grants: z.array(ApiOAuthGrantSchema) });
export const ApiOAuthGrantRevokeResponseSchema = z.object({ success: z.literal(true) });
export const ApiOAuthGrantRevokeAllResponseSchema = z.object({ success: z.literal(true), revoked: z.number() });
export type ApiOAuthGrant = z.infer<typeof ApiOAuthGrantSchema>;
export type ApiOAuthGrantListResponse = z.infer<typeof ApiOAuthGrantListResponseSchema>;
export type ApiOAuthGrantRevokeResponse = z.infer<typeof ApiOAuthGrantRevokeResponseSchema>;
export type ApiOAuthGrantRevokeAllResponse = z.infer<typeof ApiOAuthGrantRevokeAllResponseSchema>;

export const ApiPasswordSessionResponseSchema = z.object({ user: ApiAuthSessionUserSchema });
export const ApiPasswordSetupAcceptedResponseSchema = z.object({ accepted: z.literal(true) });
export const ApiPasswordSetupContextResponseSchema = z.object({ email: z.string(), isNewAccount: z.boolean() });
export const ApiPasswordRegistrationResponseSchema = z.object({
  accepted: z.literal(true),
  user: ApiAuthSessionUserSchema.optional(),
});
export const ApiPasswordVerificationResponseSchema = z.object({
  state: z.enum(['verified', 'already_verified']),
  user: ApiAuthSessionUserSchema,
});
export const ApiPasswordStatusResponseSchema = z.object({ configured: z.boolean() });
export const ApiPasswordChangeResponseSchema = z.object({ success: z.literal(true) });

export const ApiOAuthDiscoveryResponseSchema = z.object({
  issuer: z.string(),
  // auth.md spec restates the resource and bearer methods on AS
  // metadata so clients that land here first can short-circuit
  // discovery. Optional so non-spec callers stay backwards-compatible.
  resource: z.string().optional(),
  authorization_servers: z.array(z.string()).optional(),
  bearer_methods_supported: z.array(z.string()).optional(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  registration_endpoint: z.string().optional(),
  jwks_uri: z.string(),
  response_types_supported: z.array(z.string()),
  grant_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()),
  scopes_supported: z.array(z.string()),
  // auth.md spec: the agent_auth block lives on AS metadata, not on
  // PRM. Optional so legacy callers stay happy.
  agent_auth: z.record(z.string(), z.unknown()).optional(),
});
export type ApiOAuthDiscoveryResponse = z.infer<typeof ApiOAuthDiscoveryResponseSchema>;

export const ApiJwksResponseSchema = z.object({
  keys: z.array(z.record(z.string(), z.unknown())),
});
export type ApiJwksResponse = z.infer<typeof ApiJwksResponseSchema>;

export const ApiOAuthApprovalRequestResponseSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  scopes: z.array(z.string()),
  user: z.object({
    id: z.number(),
    email: z.string(),
  }),
});
export type ApiOAuthApprovalRequestResponse = z.infer<typeof ApiOAuthApprovalRequestResponseSchema>;

export const ApiOAuthApprovalDecisionResponseSchema = z.object({
  redirectUrl: z.string(),
});
export type ApiOAuthApprovalDecisionResponse = z.infer<typeof ApiOAuthApprovalDecisionResponseSchema>;

export const ApiOAuthDynamicClientRegistrationResponseSchema = z.object({
  client_id: z.string(),
  client_name: z.string(),
  redirect_uris: z.array(z.string()),
  grant_types: z.array(z.string()),
  response_types: z.array(z.string()),
  scope: z.string(),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post', 'client_secret_basic']),
  client_id_issued_at: z.number(),
  registration_access_token: z.string(),
  registration_client_uri: z.string(),
  client_secret: z.string().optional(),
  client_secret_expires_at: z.number(),
}).meta({ id: 'ApiOAuthDynamicClientRegistrationResponse' });
export type ApiOAuthDynamicClientRegistrationResponse = z.infer<typeof ApiOAuthDynamicClientRegistrationResponseSchema>;
