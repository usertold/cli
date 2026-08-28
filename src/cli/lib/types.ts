export type CliEnvironment = 'production' | 'stage' | 'local';

export type ParsedArgs = {
  raw: string[];
  options: Record<string, string>;
  multiOptions: Record<string, string[]>;
  positionals: string[];
};

export type StoredToken = {
  accessToken: string;
  expiresAt: number;
  issuedAt: number;
  scope?: string;
};

export type StoredConfig = {
  environment: string;
  baseUrl: string;
  clientId: string;
  token: StoredToken;
  user: unknown;
  updatedAt: string;
};

export type StoredEnvironmentPreferences = {
  currentProjectRef?: string;
};

export type MultiEnvConfig = {
  configs: Record<string, StoredConfig>;
  preferences?: Record<string, StoredEnvironmentPreferences>;
};
