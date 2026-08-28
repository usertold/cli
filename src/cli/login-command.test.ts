import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type CliRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--import', 'tsx', 'src/cli/index.ts', ...args], {
      env,
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => { stdout += c.toString(); });
    child.stderr?.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runCliInteractive(
  args: string[],
  env: NodeJS.ProcessEnv,
  onStdout: (chunk: string, accumulated: string) => void | Promise<void>,
): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--import', 'tsx', 'src/cli/index.ts', ...args], {
      env,
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => {
      const chunk = c.toString();
      stdout += chunk;
      void onStdout(chunk, stdout);
    });
    child.stderr?.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function readConfig(tmpDir: string): Promise<Record<string, unknown>> {
  const configPath = path.join(tmpDir, 'usertold-cli', 'config.json');
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

test('auth login --token stores credentials without OAuth flow', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-login-token-'));
  await mkdir(path.join(tmpDir, 'usertold-cli'), { recursive: true });

  const env = {
    ...process.env,
    XDG_CONFIG_HOME: tmpDir,
    USERTOLD_API_BASE: 'http://127.0.0.1:9876',
  };

  try {
    const res = await runCli(['auth', 'login', '--env', 'stage', '--token', 'token_direct'], env);
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /Token saved for environment "stage"/);

    const config = await readConfig(tmpDir);
    const stage = (config.configs as Record<string, Record<string, unknown>>).stage;
    assert.equal(stage.baseUrl, 'http://127.0.0.1:9876');
    assert.equal((stage.token as Record<string, unknown>).accessToken, 'token_direct');
    assert.equal((stage.user as null), null);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('auth login completes OAuth code flow with --no-browser and stores exchanged token', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-login-oauth-'));
  await mkdir(path.join(tmpDir, 'usertold-cli'), { recursive: true });
  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        authorization_endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}/authorize`,
      }));
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/authorize')) {
      const url = new URL(req.url, `http://127.0.0.1:${(server.address() as { port: number }).port}`);
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = url.searchParams.get('state');
      assert.ok(redirectUri);
      assert.ok(state);
      res.writeHead(302, { location: `${redirectUri}?code=auth_code_1&state=${state}` });
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/api/oauth/token') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const bodyRaw = Buffer.concat(chunks).toString('utf8');
        requests.push({ method: req.method || 'GET', url: req.url || '/', body: JSON.parse(bodyRaw) });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          access_token: 'token_oauth',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email',
          user: {
            id: 99,
            email: 'oauth@example.com',
            needs_onboarding: true,
            needs_terms_acceptance: true,
            needs_org_handle_review: true,
          },
        }));
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const env = {
    ...process.env,
    XDG_CONFIG_HOME: tmpDir,
    USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`,
  };

  let opened = false;
  try {
    const result = await runCliInteractive(
      ['auth', 'login', '--env', 'stage', '--no-browser', '--port', '0'],
      env,
      async (_chunk, output) => {
        if (opened) return;
        const match = output.match(/http:\/\/127\.0\.0\.1:[0-9]+\/authorize[^\s]*/);
        if (!match) return;
        opened = true;
        await fetch(match[0], { redirect: 'follow' });
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Received authorization code/);
    assert.match(result.stdout, /Login successful/);
    assert.match(result.stdout, /Account setup required before using the API\./);
    assert.match(result.stdout, /Open the onboarding page:/);
    assert.match(result.stdout, /Accept the latest Terms of Service\./);
    assert.match(result.stdout, /Confirm your personal organization handle is unique\./);

    assert.equal(requests.length, 1);
    const body = requests[0].body as Record<string, unknown>;
    assert.equal(body.code, 'auth_code_1');
    assert.equal(body.client_id, 'usertold-cli');
    assert.equal(body.grant_type, 'authorization_code');
    assert.match(body.redirect_uri as string, /^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    assert.notEqual(body.redirect_uri, 'http://127.0.0.1:0/callback');

    const config = await readConfig(tmpDir);
    const stage = (config.configs as Record<string, Record<string, unknown>>).stage;
    assert.equal((stage.token as Record<string, unknown>).accessToken, 'token_oauth');
    assert.equal(((stage.user as Record<string, unknown>).email), 'oauth@example.com');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(tmpDir, { recursive: true, force: true });
  }
});
