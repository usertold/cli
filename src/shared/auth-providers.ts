export const CONNECTED_AUTH_PROVIDERS = ['google', 'github', 'linear'] as const;

export type ConnectedAuthProvider = (typeof CONNECTED_AUTH_PROVIDERS)[number];

export function deriveConnectedAuthProviders(user: {
  google_id: string | null;
  github_id: string | null;
  linear_id: string | null;
}): ConnectedAuthProvider[] {
  return CONNECTED_AUTH_PROVIDERS.filter((provider) => Boolean(user[`${provider}_id`]));
}
