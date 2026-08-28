import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { StoredConfig, MultiEnvConfig } from './types';
import { resolveWidgetEmbedOriginForEnvironment } from '../../shared/widget-embed';
import { assertSideEffectAllowed } from './dry-run';

export const DEFAULT_ENVIRONMENT = 'production';
const CONFIG_DIR_NAME = 'usertold-cli';
const CONFIG_FILE_NAME = 'config.json';

async function loadMultiEnvConfig(): Promise<MultiEnvConfig | null> {
  const configPath = await getConfigPath();
  try {
    const raw = await readFile(configPath, 'utf8');
    const data = JSON.parse(raw);

    // Handle legacy single config format
    if (data.environment && data.token && !data.configs) {
      const legacyConfig = data as StoredConfig;
      return {
        configs: {
          [legacyConfig.environment]: legacyConfig
        }
      };
    }

    return data as MultiEnvConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function saveMultiEnvConfig(multiConfig: MultiEnvConfig): Promise<void> {
  assertSideEffectAllowed('write CLI configuration');
  const configPath = await getConfigPath();
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(multiConfig, null, 2), 'utf8');
}

export async function saveConfig(config: StoredConfig): Promise<void> {
  const multiConfig = await loadMultiEnvConfig() || { configs: {} };
  multiConfig.configs[config.environment] = config;
  await saveMultiEnvConfig(multiConfig);
}

export async function loadStoredConfig(environment?: string): Promise<StoredConfig | null> {
  const multiConfig = await loadMultiEnvConfig();
  if (!multiConfig) return null;

  // Always use the provided environment, never fall back to a stored default
  const env = environment || DEFAULT_ENVIRONMENT;
  return multiConfig.configs[env] || null;
}

export async function loadCurrentProjectRef(environment?: string): Promise<string | null> {
  const multiConfig = await loadMultiEnvConfig();
  if (!multiConfig) return null;

  const env = environment || DEFAULT_ENVIRONMENT;
  const currentProjectRef = multiConfig.preferences?.[env]?.currentProjectRef;
  return typeof currentProjectRef === 'string' && currentProjectRef.length > 0
    ? currentProjectRef
    : null;
}

export async function saveCurrentProjectRef(environment: string, projectRef: string): Promise<void> {
  const multiConfig = await loadMultiEnvConfig() || { configs: {} };
  const preferences = multiConfig.preferences ?? {};
  preferences[environment] = {
    ...preferences[environment],
    currentProjectRef: projectRef,
  };

  await saveMultiEnvConfig({
    ...multiConfig,
    preferences,
  });
}

export async function removeConfig(environment?: string): Promise<void> {
  assertSideEffectAllowed('remove CLI configuration');
  if (!environment) {
    // Remove all configs
    const configPath = await getConfigPath();
    await rm(configPath);
    return;
  }

  // Remove specific environment config
  const multiConfig = await loadMultiEnvConfig();
  if (multiConfig) {
    delete multiConfig.configs[environment];

    if (Object.keys(multiConfig.configs).length === 0) {
      // If no configs left, remove the file
      const configPath = await getConfigPath();
      await rm(configPath);
    } else {
      await saveMultiEnvConfig(multiConfig);
    }
  }
}

export async function getConfigPath(): Promise<string> {
  const baseDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(baseDir, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
}

export function resolveBaseUrl(env: string): string {
  // Allow env var override for custom deployments / testing
  if (process.env.USERTOLD_API_BASE) {
    return process.env.USERTOLD_API_BASE.replace(/\/$/, '');
  }

  return resolveWidgetEmbedOriginForEnvironment(env);
}
