import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage } from 'node:http';

type Result = { code: number | null; stdout: string; stderr: string };

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--import', 'tsx', 'src/cli/index.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
}

test('browser-session exchanges durable CLI auth into Playwright storage state', async () => {
  const requests: Array<{ url: string; authorization?: string }> = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url ?? '', authorization: req.headers.authorization });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ token: 'browser-jwt', cookieName: '__Host-usertold-session', expiresIn: 300 }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const result = await runCli([
      'auth', 'browser-session', '--token', 'durable-oauth-token',
      '--base-url', `http://127.0.0.1:${address.port}`,
    ], {});
    assert.equal(result.code, 0, result.stderr);
    const storage = JSON.parse(result.stdout) as { cookies: Array<{ value: string; domain: string }> };
    assert.equal(storage.cookies[0].value, 'browser-jwt');
    assert.equal(storage.cookies[0].domain, '127.0.0.1');
    assert.deepEqual(requests, [{ url: '/api/auth/session-state', authorization: 'Bearer durable-oauth-token' }]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('organization and typed settings commands call only customer workspace APIs', async () => {
  const requests: Array<{ method?: string; url?: string; body: unknown }> = [];
  const server = createServer(async (req, res) => {
    requests.push({ method: req.method, url: req.url, body: await readBody(req) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.url?.includes('/settings') ? { settings: { retention_days: '90' } } : { accepted: true }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const env = { USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`, USERTOLD_API_KEY: 'test-token' };
  try {
    const invite = await runCli([
      'organization', 'invite', 'acme', '--email', 'teammate@example.com', '--role', 'member',
      '--access', 'selected', '--projects', 'prj_one,prj_two', '--json',
    ], env);
    assert.equal(invite.code, 0, invite.stderr);

    const setting = await runCli([
      'settings', 'set', 'acme/checkout', '--key', 'retention_days', '--value', '90', '--json',
    ], env);
    assert.equal(setting.code, 0, setting.stderr);

    assert.deepEqual(requests, [
      {
        method: 'POST', url: '/api/organizations/acme/invitations',
        body: { email: 'teammate@example.com', role: 'member', projectAccess: { scope: 'selected', projectIds: ['prj_one', 'prj_two'] } },
      },
      {
        method: 'PATCH', url: '/api/orgs/acme/projects/checkout/settings',
        body: { retention_days: '90' },
      },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('integration commands configure project delivery without exposing generic API access', async () => {
  const requests: Array<{ method?: string; url?: string; body: unknown }> = [];
  const server = createServer(async (req, res) => {
    requests.push({ method: req.method, url: req.url, body: await readBody(req) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const env = { USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`, USERTOLD_API_KEY: 'test-token' };
  try {
    const result = await runCli([
      'integration', 'linear-select-team', 'acme/checkout', '--team-id', 'team_123', '--json',
    ], env);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(requests, [{
      method: 'POST', url: '/api/orgs/acme/projects/checkout/linear/select-team', body: { team_id: 'team_123' },
    }]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
