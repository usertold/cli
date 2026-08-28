import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
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

test('auth whoami verifies token and auth token command reads config/env correctly', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-auth-'));
  const cfgDir = path.join(tmpDir, 'usertold-cli');
  await mkdir(cfgDir, { recursive: true });
  await writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({
    configs: {
      stage: {
        environment: 'stage',
        baseUrl: 'http://127.0.0.1:1',
        token: {
          accessToken: 'cfg_token_stage',
          expiresAt: Date.now() + 60_000,
          issuedAt: Date.now(),
          scope: 'openid profile',
        },
        user: {
          id: 7,
          name: 'Config User',
          email: 'cfg@example.com',
          personal_org_handle: 'cfg-workspace',
          apiKey: 'user_nested_secret',
        },
      },
    },
  }), 'utf8');

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/user/profile') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 7, email: 'cfg@example.com', name: 'Config User', personal_org_handle: 'cfg-workspace' }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');

  const env = {
    ...process.env,
    USERTOLD_API_BASE: `http://127.0.0.1:${addr.port}`,
    XDG_CONFIG_HOME: tmpDir,
  };

  try {
    const whoami = await runCli(['auth', 'whoami', '--env', 'stage', '--json'], env);
    assert.equal(whoami.code, 0, whoami.stderr);
    assert.match(whoami.stdout, /"profile":\s*\{/);
    assert.match(whoami.stdout, /"cfg@example\.com"/);
    assert.match(whoami.stdout, /"personal_org_handle":\s*"cfg-workspace"/);
    assert.doesNotMatch(whoami.stdout, /cfg_token_stage/);
    assert.doesNotMatch(whoami.stdout, /user_nested_secret/);
    const whoamiPayload = JSON.parse(whoami.stdout) as {
      user: Record<string, unknown>;
      token: { accessToken?: string; expiresAt: number; issuedAt: number; scope?: string };
    };
    assert.deepEqual(whoamiPayload.user, {
      id: 7,
      name: 'Config User',
      email: 'cfg@example.com',
      personal_org_handle: 'cfg-workspace',
    });
    assert.equal(whoamiPayload.token.accessToken, undefined);
    assert.equal(typeof whoamiPayload.token.expiresAt, 'number');
    assert.equal(typeof whoamiPayload.token.issuedAt, 'number');
    assert.equal(whoamiPayload.token.scope, 'openid profile');

    const tokenFromConfig = await runCli(['auth', 'token', '--env', 'stage'], env);
    assert.equal(tokenFromConfig.code, 0, tokenFromConfig.stderr);
    const cfgPayload = JSON.parse(tokenFromConfig.stdout) as { token: string; source: string };
    assert.equal(cfgPayload.token, 'cfg_token_stage');
    assert.equal(cfgPayload.source, 'config');

    const tokenFromEnv = await runCli(['auth', 'token', '--env', 'stage', '--json'], {
      ...env,
      USERTOLD_API_KEY: 'env_override_token',
    });
    assert.equal(tokenFromEnv.code, 0, tokenFromEnv.stderr);
    assert.match(tokenFromEnv.stdout, /"source":\s*"env"/);
    assert.match(tokenFromEnv.stdout, /env_override_token/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(tmpDir, { recursive: true, force: true });
  }
});
