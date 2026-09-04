import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

type CliRunResult = { code: number | null; stdout: string; stderr: string };

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--import', 'tsx', 'src/cli/index.ts', ...args], {
      env,
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => {
      stdout += c.toString();
    });
    child.stderr?.on('data', (c) => {
      stderr += c.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('findings commands preserve the complete task-shaped HTTP contract', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/tasks?status=ready&target_surface=all&limit=5&offset=10') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ tasks: [{ id: 'task_1' }] }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/tasks') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ task: { id: 'task_2' } }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/tasks/from-signals') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ task: { id: 'tsk_3' }, linkedSignalIds: ['sig_1'], priority: { score: 80, label: 'high' } }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/tasks/tsk_2') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ task: { id: 'tsk_2' }, signals: [] }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/tasks/tsk_2') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/tasks/tsk_2/provider-state') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ providers: [] }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/tasks/tsk_2/push') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ taskId: 'tsk_2', provider: 'github', issueUrl: null, issueNumber: null, status: 'ready', pushed: true, alreadyPushed: false }));
        return;
      }

      if (req.method === 'DELETE' && req.url === '/api/orgs/acme/projects/checkout/tasks/tsk_2') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/tasks/ready?limit=3') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ tasks: [] }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const env = {
    ...process.env,
    USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`,
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const list = await runCli([
      'findings', 'list', 'acme/checkout',
      '--status', 'ready',
      '--target-surface', 'all',
      '--limit', '5',
      '--offset', '10',
      '--json',
    ], env);
    assert.equal(list.code, 0, list.stderr);
    const listPayload = JSON.parse(list.stdout) as Record<string, unknown>;
    assert.ok('findings' in listPayload);
    assert.ok(!('tasks' in listPayload));
    assert.match(list.stdout, /task_1/);

    const create = await runCli([
      'findings', 'create', 'acme/checkout',
      '--title', 'Fix checkout',
      '--description', 'Users cannot submit',
      '--effort', 'm',
      '--priority', '85',
      '--json',
    ], env);
    assert.equal(create.code, 0, create.stderr);

    const createReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/tasks');
    assert.equal((createReq?.body as { title?: string })?.title, 'Fix checkout');
    assert.equal((createReq?.body as { priority_score?: number })?.priority_score, 85);

    const get = await runCli(['findings', 'get', 'acme/checkout', 'tsk_2', '--json'], env);
    assert.equal(get.code, 0, get.stderr);

    const fromEvidence = await runCli([
      'findings', 'create-from-evidence', 'acme/checkout',
      '--title', 'Checkout confusion', '--description', 'Repeated pattern', '--evidence', 'sig_1', '--json',
    ], env);
    assert.equal(fromEvidence.code, 0, fromEvidence.stderr);
    const fromEvidenceReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/tasks/from-signals');
    assert.deepEqual(fromEvidenceReq?.body, { title: 'Checkout confusion', signal_ids: ['sig_1'], description: 'Repeated pattern' });

    const updateTask = await runCli(['findings', 'update', 'acme/checkout', 'tsk_2', '--status', 'done', '--json'], env);
    assert.equal(updateTask.code, 0, updateTask.stderr);

    const updateReq = requests.find((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/tasks/tsk_2');
    assert.equal((updateReq?.body as { status?: string })?.status, 'done');

    const pushStatus = await runCli(['findings', 'push-status', 'acme/checkout', 'tsk_2', '--json'], env);
    assert.equal(pushStatus.code, 0, pushStatus.stderr);

    const push = await runCli(['findings', 'push', 'acme/checkout', 'tsk_2', '--json'], env);
    assert.equal(push.code, 0, push.stderr);

    const remove = await runCli(['findings', 'delete', 'acme/checkout', 'tsk_2', '--json'], env);
    assert.equal(remove.code, 0, remove.stderr);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('findings commands reject the removed --type option', async () => {
  const env = {
    ...process.env,
    USERTOLD_API_BASE: 'http://127.0.0.1:1',
    USERTOLD_API_KEY: 'token-from-env',
  };

  const result = await runCli(['findings', 'list', 'acme/checkout', '--type', 'bug', '--json'], env);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Unknown flag\(s\): --type/);
});

test('findings measure is not a supported CLI command', async () => {
  const env = {
    ...process.env,
    USERTOLD_API_BASE: 'http://127.0.0.1:1',
    USERTOLD_API_KEY: 'token-from-env',
  };

  const result = await runCli(['findings', 'measure', 'acme/checkout', 'tsk_2', '--json'], env);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Unknown findings command: measure/);
});

test('findings commands reject prj_* project IDs before making an API request', async () => {
  const requests: Array<{ method: string; url: string }> = [];

  const server = createServer((req, res) => {
    requests.push({ method: req.method || 'GET', url: req.url || '/' });

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const env = {
    ...process.env,
    USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`,
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const result = await runCli(['findings', 'list', 'prj_1', '--json'], env);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /requires canonical project refs/i);
    assert.deepEqual(requests, []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('findings push retries Cloudflare 1010 and 500 responses before succeeding', async () => {
  let pushAttempts = 0;

  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/tasks/tsk_1/push') {
      pushAttempts += 1;

      if (pushAttempts === 1) {
        res.writeHead(403, { 'content-type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Access denied</h1>
              <p>Error code: 1010</p>
              <p>banned your access based on your browser's signature</p>
            </body>
          </html>
        `);
        return;
      }

      if (pushAttempts === 2) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'temporary rate limit spike' }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        taskId: 'tsk_1',
        provider: 'linear',
        issueUrl: 'https://linear.app/acme/issue/USE-78',
        issueNumber: 'USE-78',
        status: 'Backlog',
        pushed: true,
        alreadyPushed: false,
      }));
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
    USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`,
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const result = await runCli(['findings', 'push', 'acme/checkout', 'tsk_1', '--json'], env);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /"pushed": true/);
    assert.equal(pushAttempts, 3);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
