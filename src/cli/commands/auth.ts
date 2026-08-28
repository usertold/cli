import type { CliEnvironment, ParsedArgs } from '../lib/types';
import { loadStoredConfig } from '../lib/config';
import { getBooleanOption, hasHelpFlag, parseEnvironment } from '../lib/args';

import { fail, failAuth } from '../lib/errors';
import { requestRaw } from '../lib/http';
import { isJsonOutput } from '../lib/output';
import { handleLogin } from './login';
import { handleLogout } from './logout';
import { handleTermsCommand } from './terms';
import { printCommandHelp } from './help-manifest';

export async function handleAuthCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('auth');
    return;
  }

  switch (subcommand) {
    case 'login':
      await handleLogin(parsed);
      return;
    case 'logout':
      await handleLogout(parsed);
      return;
    case 'whoami':
      await handleWhoami(parsed);
      return;
    case 'token':
      await handleToken(parsed);
      return;
    case 'terms':
      await handleTermsCommand(parsed);
      return;
    default:
      fail(`Unknown auth command: ${subcommand}`);
  }
}


export async function handleWhoami(parsed: ParsedArgs): Promise<void> {
  const env = parseEnvironment(parsed);
  const config = await loadStoredConfig(env);

  if (!config) {
    fail(`Not authenticated for environment "${env}". Run "usertold auth login -- --env ${env}" first.`);
  }

  if (config.token.expiresAt <= Date.now()) {
    fail(`Stored token for environment "${env}" is expired. Run "usertold auth login -- --env ${env}" again.`);
  }

  const shouldVerify = !getBooleanOption(parsed, 'no-verify');
  const profile = shouldVerify ? await fetchProfile(env) : null;
  const user = asRecord(config.user);

  if (isJsonOutput(parsed)) {
    console.log(JSON.stringify({
      environment: config.environment,
      baseUrl: config.baseUrl,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        personal_org_handle: user.personal_org_handle,
      } : null,
      token: {
        expiresAt: config.token.expiresAt,
        issuedAt: config.token.issuedAt,
        scope: config.token.scope,
      },
      profile,
    }, null, 2));
    return;
  }

  const name = typeof user?.name === 'string' ? user.name : 'unknown';
  const email = typeof user?.email === 'string' ? user.email : 'unknown';
  const personalOrgHandle = profile?.personal_org_handle
    ?? (typeof user?.personal_org_handle === 'string' ? user.personal_org_handle : null);

  console.log(`environment: ${env}`);
  console.log(`base_url: ${config.baseUrl}`);
  console.log(`name: ${name}`);
  console.log(`email: ${email}`);
  if (personalOrgHandle) {
    console.log(`personal_org_handle: ${personalOrgHandle}`);
  }
  console.log(`token_expires_at: ${new Date(config.token.expiresAt).toISOString()}`);
  if (profile !== null) {
    console.log(`verified: yes`);
  }
}

async function fetchProfile(env: CliEnvironment): Promise<{ personal_org_handle: string | null } | null> {
  const response = await requestRaw({
    env,
    method: 'GET',
    path: '/api/user/profile',
    authMode: 'required',
  });

  if (!response.ok) {
    const message = response.text.trim() || 'Token validation failed';
    failAuth(`Unable to verify token with server (${response.status}): ${message}`);
  }

  if (response.json && typeof response.json === 'object') {
    const data = response.json as Record<string, unknown>;
    return { personal_org_handle: typeof data.personal_org_handle === 'string' ? data.personal_org_handle : null };
  }

  return null;
}

async function handleToken(parsed: ParsedArgs): Promise<void> {
  // Check env var first
  const envToken = process.env.USERTOLD_API_KEY;
  if (envToken) {
    if (isJsonOutput(parsed)) {
      console.log(JSON.stringify({ token: envToken, source: 'env' }));
    } else {
      console.log(envToken);
    }
    return;
  }

  const env = parseEnvironment(parsed);
  const config = await loadStoredConfig(env);

  if (!config) {
    failAuth(`No token available for environment "${env}".`);
  }

  if (config.token.expiresAt <= Date.now()) {
    failAuth(`Token for environment "${env}" is expired.`);
  }

  if (isJsonOutput(parsed)) {
    console.log(JSON.stringify({
      token: config.token.accessToken,
      source: 'config',
      expires_at: new Date(config.token.expiresAt).toISOString(),
    }));
  } else {
    console.log(config.token.accessToken);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
