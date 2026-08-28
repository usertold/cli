import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ParsedArgs } from '../lib/types';
import { parseEnvironment } from '../lib/args';
import { loadStoredConfig, resolveBaseUrl } from '../lib/config';
import { assertSideEffectAllowed } from '../lib/dry-run';
import { failAuth, failArgs } from '../lib/errors';
import { buildCliUserAgent } from '../lib/user-agent';

type SessionStateResponse = {
  token: string;
  cookieName?: string;
  expiresIn?: number;
};

const FORMATS = ['storage', 'env', 'cookie', 'jwt'] as const;
type BrowserSessionFormat = typeof FORMATS[number];

export async function handleBrowserSession(parsed: ParsedArgs): Promise<void> {
  const env = parseEnvironment(parsed);
  const format = parseFormat(parsed.options.format);
  const explicitToken = optionValue(parsed.options.token);
  const stored = explicitToken ? null : await loadStoredConfig(env);
  const token = explicitToken ?? process.env.USERTOLD_API_KEY ?? stored?.token.accessToken;

  if (!token) {
    failAuth(`No durable OAuth credential is available for environment "${env}". Run "usertold auth login --env ${env}" first.`);
  }
  if (!explicitToken && !process.env.USERTOLD_API_KEY && stored && stored.token.expiresAt <= Date.now()) {
    failAuth(`Stored token for environment "${env}" is expired. Run "usertold auth login --env ${env}" again.`);
  }

  const baseUrl = normalizeBaseUrl(optionValue(parsed.options['base-url']) ?? stored?.baseUrl ?? resolveBaseUrl(env));
  assertSideEffectAllowed('mint a short-lived browser session');
  const response = await fetch(new URL('/api/auth/session-state', baseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      'user-agent': buildCliUserAgent(),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    failAuth(`Browser-session exchange failed (${response.status}): ${text.trim() || 'request failed'}`);
  }

  let body: SessionStateResponse;
  try {
    body = JSON.parse(text) as SessionStateResponse;
  } catch {
    failAuth('Browser-session exchange returned invalid JSON.');
  }
  if (typeof body.token !== 'string' || body.token.length === 0) {
    failAuth('Browser-session exchange did not return a token.');
  }

  const cookieName = typeof body.cookieName === 'string' ? body.cookieName : '__Host-usertold-session';
  const output = formatOutput(format, cookieName, body.token, baseUrl);
  const outputPath = optionValue(parsed.options.output);
  if (!outputPath) {
    process.stdout.write(`${output}\n`);
    return;
  }

  assertSideEffectAllowed(`write browser credentials to ${outputPath}`);
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, `${output}\n`, { mode: 0o600 });
  await chmod(outputPath, 0o600);
  const ttl = typeof body.expiresIn === 'number' ? `, expires in ${body.expiresIn}s` : '';
  process.stderr.write(`Wrote ${format} browser credentials (${env}, ${new URL(baseUrl).hostname}${ttl}) -> ${outputPath} (mode 600)\n`);
}

function parseFormat(value: string | undefined): BrowserSessionFormat {
  const format = value && value !== 'true' ? value : 'storage';
  if (!FORMATS.includes(format as BrowserSessionFormat)) {
    failArgs(`Invalid --format "${format}". Expected: ${FORMATS.join(', ')}`);
  }
  return format as BrowserSessionFormat;
}

function optionValue(value: string | undefined): string | undefined {
  return value && value !== 'true' ? value : undefined;
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    failArgs(`Invalid --base-url "${value}".`);
  }
  const loopback = url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
    || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !loopback) {
    failArgs('--base-url must use HTTPS, except for localhost development.');
  }
  return url.origin;
}

function formatOutput(format: BrowserSessionFormat, cookieName: string, token: string, baseUrl: string): string {
  switch (format) {
    case 'storage':
      return JSON.stringify({
        cookies: [{
          name: cookieName,
          value: token,
          domain: new URL(baseUrl).hostname,
          path: '/',
          httpOnly: true,
          secure: new URL(baseUrl).protocol === 'https:',
          sameSite: 'Lax',
        }],
        origins: [],
      }, null, 2);
    case 'env':
      return `UT_SESSION_TOKEN=${token}`;
    case 'cookie':
      return `${cookieName}=${token}`;
    case 'jwt':
      return token;
  }
}
