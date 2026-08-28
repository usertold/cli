export const ACCOUNT_CAPABILITY_KEYS = [
  'profile_workspace_edit',
  'draft_research',
  'paid_inference',
  'promotional_credit',
  'study_launch',
  'billing_changes',
  'exports',
  'invitations',
  'integrations',
  'cli_mcp_grants',
] as const;

export type AccountCapability = typeof ACCOUNT_CAPABILITY_KEYS[number];
export type AccountActivationState = 'provisional' | 'active' | 'reclaimed';
export type AccountCapabilities = Record<AccountCapability, boolean>;
export const PROVISIONAL_ACCOUNT_RETENTION_DAYS = 30;

export function normalizeAccountActivationState(state: AccountActivationState | null | undefined): AccountActivationState {
  return state ?? 'active';
}

export function accountCapabilities(rawState: AccountActivationState | null | undefined): AccountCapabilities {
  const state = normalizeAccountActivationState(rawState);
  const active = state === 'active';
  return {
    profile_workspace_edit: state !== 'reclaimed',
    draft_research: state !== 'reclaimed',
    paid_inference: active,
    promotional_credit: active,
    study_launch: active,
    billing_changes: active,
    exports: active,
    invitations: active,
    integrations: active,
    cli_mcp_grants: active,
  };
}
