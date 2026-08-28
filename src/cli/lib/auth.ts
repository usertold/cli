import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import type { Socket } from 'node:net';
import { buildCliUserAgent } from './user-agent';

export const DEFAULT_CLIENT_ID = 'usertold-cli';
export const DEFAULT_REDIRECT_PORT = 8765;
export const AUTH_SCOPES = 'openid profile email';

/**
 * Detect how the CLI was invoked and return the appropriate command string.
 * Examples:
 * - "usertold" when installed globally or run as bundled binary
 * - "pnpm run cli" when run via package.json script (local dev)
 * - "npx usertold" when run via npx
 */
function detectCliCommand(): string {
  const argv = process.argv;

  // Check if run as the bundled binary
  if (argv[1]?.includes('usertold')) {
    return 'usertold';
  }

  // Check if run via package manager script
  if (argv[1]?.includes('pnpm') || argv[1]?.includes('npm') || process.env.npm_lifecycle_event) {
    return 'pnpm run cli';
  }

  // Check if run via npx
  if (argv[0]?.includes('npx') || process.env.npm_execpath?.includes('npx')) {
    return 'npx usertold';
  }

  // Fallback
  return 'usertold';
}

export const CLI_COMMAND = detectCliCommand();

export async function fetchOidcConfiguration(baseUrl: string, insecure = false): Promise<Record<string, unknown>> {
  const fetchOptions: RequestInit = {
    headers: {
      'accept': 'application/json',
      'user-agent': buildCliUserAgent(),
    },
  };

  // For local dev with self-signed certificates
  if (insecure) {
    const nodeOptions = fetchOptions as Record<string, unknown>;
    nodeOptions.rejectUnauthorized = false;
  }

  const response = await fetch(`${baseUrl}/.well-known/openid-configuration`, fetchOptions);

  if (!response.ok) {
    throw new Error(`Failed to load OIDC configuration (${response.status})`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function exchangeCodeForToken(input: {
  baseUrl: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}) {
  const response = await fetch(`${input.baseUrl}/api/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': buildCliUserAgent(),
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type: string;
    user?: unknown;
  }>;
}

export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return base64UrlEncode(hash);
}

export function generateState(): string {
  return base64UrlEncode(randomBytes(16));
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function startAuthorizationCodeListener(port: number, expectedState: string): {
  ready: Promise<number>;
  result: Promise<{ code: string }>;
} {
  let rejectResult: (error: Error) => void = () => {};
  let resolveResult: (value: { code: string }) => void = () => {};
  let settled = false;
  let timeout: NodeJS.Timeout | undefined;
  const sockets = new Set<Socket>();

  const server = http.createServer((req, res) => {
    if (!req.url) {
      respondWithError(res, 'invalid_request', 'Invalid request');
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname !== '/callback') {
      respondWithError(res, 'not_found', 'Page not found', 404);
      return;
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth error response
    if (error) {
      respondWithTerminalError(
        res,
        error,
        errorDescription || undefined,
        new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`),
      );
      return;
    }

    if (!code) {
      respondWithTerminalError(
        res,
        'invalid_request',
        'Missing authorization code',
        new Error('Missing authorization code'),
      );
      return;
    }

    if (state !== expectedState) {
      respondWithTerminalError(
        res,
        'invalid_request',
        'State parameter mismatch - possible CSRF attack',
        new Error('State mismatch'),
      );
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html', 'Connection': 'close' });
    res.end(getSuccessPage(), () => {
      settleWithCode(code);
    });
  });

  const result = new Promise<{ code: string }>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => {
      sockets.delete(socket);
    });
  });

  const ready = new Promise<number>((resolve, reject) => {
    const handleStartupError = (error: Error) => {
      const startupError = new Error(`Failed to start local callback server: ${error.message}`);
      settleWithError(startupError);
      reject(startupError);
    };

    server.once('error', handleStartupError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', handleStartupError);
      server.on('error', (error) => {
        settleWithError(new Error(`Local callback server error: ${(error as Error).message}`));
      });
      const address = server.address();
      if (!address || typeof address === 'string') {
        const addressError = new Error('Failed to determine local callback server port');
        settleWithError(addressError);
        reject(addressError);
        return;
      }
      resolve(address.port);
    });
  });

  timeout = setTimeout(() => {
    settleWithError(new Error('Login timed out waiting for authorization response'));
  }, 5 * 60 * 1000);

  return { ready, result };

  function respondWithError(
    res: http.ServerResponse,
    error: string,
    description: string,
    status = 400,
  ): void {
    res.writeHead(status, { 'Content-Type': 'text/html', 'Connection': 'close' });
    res.end(getErrorPage(error, description));
  }

  function respondWithTerminalError(
    res: http.ServerResponse,
    error: string,
    description: string | undefined,
    terminalError: Error,
  ): void {
    res.writeHead(400, { 'Content-Type': 'text/html', 'Connection': 'close' });
    res.end(getErrorPage(error, description), () => {
      settleWithError(terminalError);
    });
  }

  function settleWithCode(code: string): void {
    if (settled) return;
    settled = true;
    closeCallbackServer();
    resolveResult({ code });
  }

  function settleWithError(error: Error): void {
    if (settled) return;
    settled = true;
    closeCallbackServer();
    rejectResult(error);
  }

  function closeCallbackServer(): void {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    server.close();
    server.closeIdleConnections();
    server.closeAllConnections();

    for (const socket of sockets) {
      socket.destroy();
    }
  }
}

export async function waitForAuthorizationCode(port: number, expectedState: string): Promise<{ code: string }> {
  const listener = startAuthorizationCodeListener(port, expectedState);
  await listener.ready;
  return listener.result;
}

// =============================================================================
// CLI Auth Page Design Tokens
// Resolved from: docs/web/design-system.md and src/frontend/styles/{tokens,theme,global}.css.
// These are inlined literal values — CSS variables cannot be imported here.
// If you change design tokens in those files, update the values below to match.
//
//   --paper / --paper-deep / --paper-rule      → page, panel, rule
//   --ink / --ink-soft / --ink-quiet           → text hierarchy
//   --accent / --accent-soft / --accent-line   → status and error emphasis
//   --font-mono / --font-serif                 → UI and display type
//   --radius-soft / --radius-pill              → geometry
//   spacing: --s-{1,2,3,4,5,6,7,8}             → 4px grid
// =============================================================================
const CLI_AUTH_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    color-scheme: light dark;
    font-size: 16px;
    --paper: light-dark(oklch(98% 0.005 95), oklch(14% 0.004 270));
    --paper-deep: light-dark(oklch(95% 0.008 90), oklch(18% 0.005 270));
    --paper-rule: light-dark(oklch(92% 0.012 88), oklch(28% 0.006 270));
    --ink: light-dark(oklch(20% 0 0), oklch(94% 0.003 270));
    --ink-soft: light-dark(oklch(36% 0.003 95), oklch(76% 0.004 270));
    --ink-quiet: light-dark(oklch(58% 0.008 90), oklch(56% 0.005 270));
    --ink-faint: light-dark(oklch(78% 0.012 90), oklch(38% 0.005 270));
    --accent: light-dark(oklch(56% 0.142 39), oklch(70% 0.140 42));
    --accent-deep: light-dark(oklch(43% 0.122 38), oklch(80% 0.160 45));
    --accent-soft: light-dark(oklch(89% 0.038 40), oklch(32% 0.060 38));
    --accent-line: light-dark(oklch(83% 0.060 42), oklch(40% 0.080 40));
    --accent-warm: light-dark(oklch(98% 0.018 80), oklch(22% 0.025 50));
    --font-mono: ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    --font-serif: Georgia, 'Times New Roman', Times, serif;
    --t-xs: 10px;
    --t-sm: 11px;
    --t-meta: 12px;
    --t-body: 13px;
    --t-h1: 24px;
    --leading-mono: 1.55;
    --leading-snug: 1.25;
    --track-quiet: 0.14em;
    --s-1: 4px;
    --s-2: 8px;
    --s-3: 12px;
    --s-4: 16px;
    --s-5: 20px;
    --s-6: 24px;
    --s-7: 32px;
    --s-8: 48px;
    --radius-soft: 2px;
    --radius-pill: 9999px;
    --rule: 1px solid var(--paper-rule);
  }
  body {
    font-family: var(--font-mono);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--s-8) var(--s-5);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--t-body);
    line-height: var(--leading-mono);
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ink);
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    margin-bottom: var(--s-4);
  }
  .wordmark-mark {
    width: 0.92em;
    height: 0.92em;
    display: block;
    flex: none;
  }
  .wordmark-trace {
    fill: var(--ink);
    stroke: var(--ink);
    opacity: 0.62;
  }
  .wordmark-node {
    fill: var(--accent);
  }
  .wordmark-accent {
    color: var(--accent);
  }
  .card {
    width: 100%;
    max-width: 820px;
    background: var(--paper);
    border: var(--rule);
    border-radius: var(--radius-soft);
    padding: 40px;
  }
  .status-row {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-5);
  }
  .icon-circle {
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    border: 1px solid var(--accent-line);
    background: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  .icon-circle svg { display: block; }
  .accent,
  .danger {
    color: var(--accent-deep);
  }
  .status-label {
    font-size: var(--t-xs);
    font-weight: 600;
    letter-spacing: var(--track-quiet);
    text-transform: uppercase;
    color: var(--accent-deep);
  }
  h1 {
    font-family: var(--font-serif);
    font-size: var(--t-h1);
    font-weight: 500;
    line-height: var(--leading-snug);
    margin-bottom: var(--s-3);
    color: var(--ink);
  }
  .subtitle {
    max-width: 60ch;
    color: var(--ink-soft);
    font-size: var(--t-body);
  }
  .completion-title {
    color: var(--ink-quiet);
    font-size: var(--t-xs);
    font-weight: 600;
    letter-spacing: var(--track-quiet);
    text-transform: uppercase;
  }
  .manifest {
    margin-top: var(--s-3);
    color: var(--ink);
    font-family: var(--font-serif);
    font-size: 42px;
    font-weight: 500;
    line-height: 1.04;
  }
  .manifest span {
    display: block;
  }
  .manifest .manifest-accent {
    color: var(--accent-deep);
  }
  .loop {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--s-7);
    margin-top: var(--s-7);
  }
  .loop-item {
    min-width: 0;
  }
  .loop-title {
    display: block;
    color: var(--accent-deep);
    font-family: var(--font-serif);
    font-size: 21px;
    font-weight: 600;
  }
  .loop-detail {
    display: block;
    margin-top: var(--s-2);
    color: var(--ink-soft);
    font-size: var(--t-sm);
    line-height: 1.4;
  }
  .manifest-footer {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-top: var(--s-6);
    color: var(--ink);
    font-size: var(--t-meta);
    font-weight: 600;
  }
  .manifest-arrow {
    color: var(--accent-deep);
    font-size: var(--t-body);
  }
  .error-notice {
    margin-top: var(--s-4);
    padding: var(--s-2) var(--s-3);
    background: var(--accent-soft);
    border: 1px solid var(--accent-line);
    border-radius: var(--radius-soft);
    font-size: var(--t-meta);
    color: var(--accent-deep);
    word-break: break-all;
  }
  @media (max-width: 768px) {
    body {
      padding: var(--s-6) var(--s-4);
    }
    .card {
      padding: var(--s-5);
    }
    .manifest {
      font-size: 34px;
    }
    .loop {
      grid-template-columns: 1fr;
      gap: var(--s-5);
    }
  }
`;

const CLI_AUTH_WORDMARK = `<p class="wordmark">
    <svg class="wordmark-mark" viewBox="0 0 64 64" aria-hidden="true">
      <g class="wordmark-trace">
        <path d="M42 32V45H23" fill="none" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="17" cy="45" r="8" stroke="none"/>
      </g>
      <circle cx="42" cy="21" r="11" class="wordmark-node"/>
    </svg>
    <span>UserTold<span class="wordmark-accent">.ai</span></span>
  </p>`;

function getSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You're all set — UserTold</title>
  <style>${CLI_AUTH_CSS}</style>
</head>
<body>
  ${CLI_AUTH_WORDMARK}
  <div class="card">
    <div class="status-row">
      <div class="icon-circle">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="accent">
          <path d="M11 2L3 6v5c0 4.42 3.36 8.56 8 9.56C16.64 19.56 20 15.42 20 11V6L11 2z"/>
          <path d="M7.5 11l2.5 2.5 4.5-4.5"/>
        </svg>
      </div>
      <span class="status-label">CLI authorized</span>
    </div>
    <p class="completion-title">You're all set</p>
    <h1 class="manifest">
      <span>Real users.</span>
      <span class="manifest-accent">Grounded work.</span>
      <span>Shipped change.</span>
    </h1>
    <ol class="loop" aria-label="UserTold research loop">
      <li class="loop-item">
        <strong class="loop-title">Listen.</strong>
        <span class="loop-detail">Real voices</span>
      </li>
      <li class="loop-item">
        <strong class="loop-title">Prove.</strong>
        <span class="loop-detail">Linked evidence</span>
      </li>
      <li class="loop-item">
        <strong class="loop-title">Move.</strong>
        <span class="loop-detail">Ship · learn · repeat</span>
      </li>
    </ol>
    <p class="manifest-footer">Back to your terminal <span class="manifest-arrow" aria-hidden="true">→</span></p>
  </div>
</body>
</html>`;
}

function getErrorPage(error: string, description?: string): string {
  const errorDetail = error !== 'access_denied' ? `<p class="error-notice">error: ${escapeHtml(error)}</p>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorization failed — UserTold</title>
  <style>${CLI_AUTH_CSS}</style>
</head>
<body>
  ${CLI_AUTH_WORDMARK}
  <div class="card">
    <div class="status-row">
      <div class="icon-circle">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="danger">
          <circle cx="11" cy="11" r="9"/>
          <path d="M11 7v4M11 15h.01"/>
        </svg>
      </div>
      <span class="status-label">Interrupted</span>
    </div>
    <h1>Authorization failed</h1>
    <p class="subtitle">${escapeHtml(description || 'Authorization was denied. Return to your terminal and try again.')}</p>
    ${errorDetail}
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === 'darwin') {
      command = 'open';
      args = [url];
    } else if (platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', '""', url];
    } else {
      command = 'xdg-open';
      args = [url];
    }

    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', (error) => reject(error));
    child.on('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
