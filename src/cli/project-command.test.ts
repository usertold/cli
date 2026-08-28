import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { formatProjectSnippetHumanOutput, printWidgetInstallationVerificationReport } from './commands/project';
import type { ApiWidgetInstallationVerificationReport } from '../shared/schemas/response-widget-installation';
import type { ProjectWidgetEmbedDetails } from '../shared/widget-embed';

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

const widgetVerificationReport: ApiWidgetInstallationVerificationReport = {
  project_ref: 'acme/checkout',
  requested_url: 'https://example.com/',
  final_url: 'https://www.example.com/',
  verified_at: '2026-07-26T12:00:00.000Z',
  overall_status: 'fail',
  summary: { passed: 1, warnings: 1, failed: 1 },
  fetch: {
    http_status: 200,
    redirects: [{
      from: 'https://example.com/',
      to: 'https://www.example.com/',
      status: 301,
    }],
  },
  checks: [
    {
      id: 'page.reachable',
      category: 'page',
      status: 'pass',
      title: 'Page reachable',
      message: 'The homepage returned HTTP 200.',
    },
    {
      id: 'permissions.microphone',
      category: 'permissions_policy',
      status: 'warning',
      title: 'Microphone policy',
      message: 'The microphone directive is malformed.',
    },
    {
      id: 'permissions.display_capture',
      category: 'permissions_policy',
      status: 'fail',
      title: 'Screen capture policy',
      message: 'The host page blocks screen capture.',
      observed: 'display-capture=()',
      expected: 'display-capture=(self), or no display-capture directive',
      recommendation: 'Allow screen capture for the page.',
      remediation_snippet: 'Permissions-Policy: display-capture=(self)',
    },
  ],
};

test('project verify-widget-installation sends the target URL and prints the readable project ref', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  let responseReport = widgetVerificationReport;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      requests.push({
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        body: bodyRaw ? JSON.parse(bodyRaw) : null,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(responseReport));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const env = {
    ...process.env,
    USERTOLD_API_BASE: `http://127.0.0.1:${addr.port}`,
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const result = await runCli([
      'project',
      'verify-widget-installation',
      'acme/checkout',
      '--url',
      'https://example.com/',
      '--json',
    ], env);

    assert.equal(result.code, 1, result.stderr);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), widgetVerificationReport);
    assert.deepEqual(requests[0], {
      method: 'POST',
      url: '/api/orgs/acme/projects/checkout/widget-installation/verify',
      body: {
        url: 'https://example.com/',
      },
    });

    responseReport = {
      ...widgetVerificationReport,
      overall_status: 'warning',
      summary: { passed: 1, warnings: 1, failed: 0 },
      checks: widgetVerificationReport.checks.filter((check) => check.status !== 'fail'),
    };
    const warning = await runCli([
      'project',
      'verify-widget-installation',
      'acme/checkout',
      '--url',
      'https://example.com/',
      '--json',
    ], env);
    assert.equal(warning.code, 0, warning.stderr);
    assert.deepEqual(JSON.parse(warning.stdout), responseReport);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('website integration report renderer prints every result and remediation', () => {
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => {
    lines.push(values.map(String).join(' '));
  };

  try {
    printWidgetInstallationVerificationReport(widgetVerificationReport);
  } finally {
    console.log = originalLog;
  }

  const output = lines.join('\n');
  assert.match(output, /Website integration check: FAIL/);
  assert.match(output, /PASS  Page reachable/);
  assert.match(output, /WARNING  Microphone policy/);
  assert.match(output, /FAIL  Screen capture policy/);
  assert.match(output, /Observed: display-capture=\(\)/);
  assert.match(output, /Expected: display-capture=\(self\), or no display-capture directive/);
  assert.match(output, /Recommendation: Allow screen capture for the page\./);
  assert.match(output, /Configuration: Permissions-Policy: display-capture=\(self\)/);
});

test('project snippet/status return expected data and update enforces at-least-one-field', async () => {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        projects: [{
          id: 'prj_checkout',
          name: 'Checkout',
          public_key: 'ut_pub_checkout',
          secret_key: 'ut_sec_should_not_print',
        }],
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/orgs/acme/projects') {
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ project: { id: 'acme/new' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        project: {
          id: 'acme/checkout',
          name: 'Demo',
          public_key: 'ut_pub_demo',
          github_repo_url: 'https://github.com/acme/demo',
        },
      }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/settings') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        settings: {
          openai_api_key: 'sk-***',
        },
      }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/overview') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        sessions: { total: 11 },
        signals: { total: 25 },
      }));
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
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const snippet = await runCli([
      'project',
      'snippet',
      'acme/checkout',
      '--env',
      'production',
      '--json',
    ], env);
    assert.equal(snippet.code, 0, snippet.stderr);
    const snippetPayload = JSON.parse(snippet.stdout) as ProjectWidgetEmbedDetails;
    assert.equal(snippetPayload.base_url, 'https://usertold.ai');
    assert.equal(snippetPayload.public_key, 'ut_pub_demo');
    assert.equal(snippetPayload.install_once, true);
    assert.equal(snippetPayload.study_ref_required, false);
    assert.equal(
      snippetPayload.guidance,
      "Install this Project script once across the site. Visibility selects one active Study for the current pathname and widget language; that Study's Invitation defines the launcher. One Project can contain many active Studies.",
    );
    assert.equal(
      snippetPayload.snippet,
      '<script async src="https://usertold.ai/v1/widget.js" data-project-key="ut_pub_demo"></script>',
    );
    const humanSnippet = formatProjectSnippetHumanOutput(snippetPayload);
    assert.match(humanSnippet, /<script async .*data-project-key="ut_pub_demo"><\/script>/);
    assert.match(humanSnippet, /Install this Project script once across the site\./);
    assert.match(humanSnippet, /Visibility selects one active Study/);
    assert.match(humanSnippet, /that Study's Invitation defines the launcher/);
    assert.match(humanSnippet, /One Project can contain many active Studies/);

    const rejectedStudyRef = await runCli([
      'project',
      'snippet',
      'acme/checkout',
      'study-that-does-not-belong-here',
      '--json',
    ], env);
    assert.notEqual(rejectedStudyRef.code, 0);
    assert.match(rejectedStudyRef.stderr, /Unexpected extra arguments: study-that-does-not-belong-here/);

    const status = await runCli(['project', 'status', 'acme/checkout', '--env', 'stage', '--json'], env);
    assert.equal(status.code, 0, status.stderr);
    const payload = JSON.parse(status.stdout) as {
      project_ref: string;
      github_connected: boolean;
      interview_count: number;
      evidence_count: number;
      openai_key_configured: boolean;
    };
    assert.equal(payload.project_ref, 'acme/checkout');
    assert.equal('project_id' in payload, false);
    assert.equal(payload.github_connected, true);
    assert.equal(payload.interview_count, 11);
    assert.equal(payload.evidence_count, 25);
    assert.equal(payload.openai_key_configured, true);

    const list = await runCli(['project', 'list', 'acme', '--env', 'stage', '--json'], env);
    assert.equal(list.code, 0, list.stderr);
    assert.doesNotMatch(list.stdout, /ut_sec_should_not_print|secret_key/);
    const listPayload = JSON.parse(list.stdout) as { projects: Array<{ public_key: string; secret_key?: string }> };
    assert.equal(listPayload.projects[0]?.public_key, 'ut_pub_checkout');
    assert.equal('secret_key' in listPayload.projects[0], false);

    const create = await runCli(['project', 'create', 'acme', '--name', 'Demo', '--env', 'stage', '--json'], env);
    assert.equal(create.code, 0, create.stderr);
    const createPayload = JSON.parse(create.stdout) as { project: { id: string } };
    assert.equal(createPayload.project.id, 'acme/new');

    const invalidUpdate = await runCli(['project', 'update', 'acme/checkout', '--env', 'stage'], env);
    assert.notEqual(invalidUpdate.code, 0);
    assert.match(invalidUpdate.stderr, /No fields to update/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('project get returns project detail and project delete calls DELETE and returns success', async () => {
  const requests: Array<{ method: string; url: string }> = [];

  const server = createServer((req, res) => {
    requests.push({ method: req.method || 'GET', url: req.url || '/' });

    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        project: {
          id: 'prj_checkout',
          handle: 'checkout',
          name: 'Checkout',
          description: 'Checkout flow',
          public_key: 'ut_pub_checkout',
          project_ref: 'acme/checkout',
        },
        members: [
          { user_id: 1, role: 'owner' },
          { user_id: 2, role: 'member' },
        ],
      }));
      return;
    }

    if (req.method === 'DELETE' && req.url === '/api/orgs/acme/projects/checkout') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
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
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const get = await runCli(['project', 'get', 'acme/checkout', '--json'], env);
    assert.equal(get.code, 0, get.stderr);
    const getPayload = JSON.parse(get.stdout) as { project: { handle: string }; members: unknown[] };
    assert.equal(getPayload.project.handle, 'checkout');
    assert.equal(getPayload.members.length, 2);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/orgs/acme/projects/checkout'));

    const del = await runCli(['project', 'delete', 'acme/checkout', '--json'], env);
    assert.equal(del.code, 0, del.stderr);
    const delPayload = JSON.parse(del.stdout) as { success: boolean };
    assert.equal(delPayload.success, true);
    assert.ok(requests.some((r) => r.method === 'DELETE' && r.url === '/api/orgs/acme/projects/checkout'));

    const idRef = await runCli(['project', 'get', 'prj_123', '--json'], env);
    assert.notEqual(idRef.code, 0);
    assert.match(idRef.stderr, /requires canonical project refs/i);
    assert.equal(requests.some((r) => r.url.includes('project-resolve')), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('project commands map option payloads correctly and reject non-canonical project refs', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ projects: [] }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ project: { id: 'acme/new' } }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ project: { id: 'acme/checkout' } }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ project: { id: 'acme/checkout', name: 'Checkout' } }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');

  const env = {
    ...process.env,
    USERTOLD_API_BASE: `http://127.0.0.1:${addr.port}`,
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const list = await runCli(['project', 'list', '--org', 'acme', '--json'], env);
    assert.equal(list.code, 0, list.stderr);

    const create = await runCli([
      'project', 'create', 'acme',
      '--name', 'Checkout',
      '--handle', 'checkout',
      '--description', 'Checkout improvements',
      '--json',
    ], env);
    assert.equal(create.code, 0, create.stderr);

    const createReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects');
    assert.deepEqual(createReq?.body, {
      name: 'Checkout',
      handle: 'checkout',
      description: 'Checkout improvements',
    });

    const update = await runCli([
      'project', 'update', 'acme/checkout',
      '--name', 'Checkout v2',
      '--handle', 'checkout-v2',
      '--description', 'Updated description',
      '--json',
    ], env);
    assert.equal(update.code, 0, update.stderr);

    const updateReq = requests.find((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout');
    assert.deepEqual(updateReq?.body, {
      name: 'Checkout v2',
      handle: 'checkout-v2',
      description: 'Updated description',
    });

    const idRef = await runCli(['project', 'get', 'prj_123', '--json'], env);
    assert.notEqual(idRef.code, 0);
    assert.match(idRef.stderr, /requires canonical project refs/i);
    assert.equal(requests.some((r) => r.url.includes('project-resolve')), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('project list defaults to authenticated personal org handle when omitted', async () => {
  const requests: Array<{ method: string; url: string }> = [];

  const server = createServer((req, res) => {
    requests.push({ method: req.method || 'GET', url: req.url || '/' });

    if (req.method === 'GET' && req.url === '/api/user/profile') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 7,
        email: 'cfg@example.com',
        name: 'Config User',
        personal_org_handle: 'cfg-workspace',
      }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/orgs/cfg-workspace/projects') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ projects: [{ id: 'prj_1', name: 'Checkout' }] }));
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
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const list = await runCli(['project', 'list', '--env', 'stage', '--json'], env);
    assert.equal(list.code, 0, list.stderr);
    const listPayload = JSON.parse(list.stdout) as { projects: Array<{ id: string; name: string }> };
    assert.equal(listPayload.projects[0]?.name, 'Checkout');
    assert.deepEqual(requests, [
      { method: 'GET', url: '/api/user/profile' },
      { method: 'GET', url: '/api/orgs/cfg-workspace/projects' },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('project use stores current project and project-scoped commands can omit project ref', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-project-current-'));
  const requests: Array<{ method: string; url: string }> = [];

  const server = createServer((req, res) => {
    requests.push({ method: req.method || 'GET', url: req.url || '/' });

    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        project: {
          id: 'prj_checkout',
          handle: 'checkout',
          name: 'Checkout',
          public_key: 'ut_pub_checkout',
          secret_key: 'ut_sec_current_should_not_print',
          project_ref: 'acme/checkout',
        },
      }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/settings') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ settings: { openai_api_key: 'sk-***' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/overview') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ sessions: { total: 1 }, signals: { total: 2 } }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/widget-installation/verify') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ...widgetVerificationReport,
        overall_status: 'warning',
        summary: { passed: 1, warnings: 1, failed: 0 },
        checks: widgetVerificationReport.checks.filter((check) => check.status !== 'fail'),
      }));
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
    USERTOLD_API_KEY: 'token-from-env',
    XDG_CONFIG_HOME: tmpDir,
  };

  try {
    const use = await runCli(['project', 'use', 'acme/checkout', '--env', 'stage', '--json'], env);
    assert.equal(use.code, 0, use.stderr);
    assert.doesNotMatch(use.stdout, /ut_sec_current_should_not_print|secret_key/);
    assert.equal(JSON.parse(use.stdout).current_project, 'acme/checkout');

    const current = await runCli(['project', 'current', '--env', 'stage', '--json'], env);
    assert.equal(current.code, 0, current.stderr);
    assert.equal(JSON.parse(current.stdout).current_project, 'acme/checkout');

    const status = await runCli(['project', 'status', '--env', 'stage', '--json'], env);
    assert.equal(status.code, 0, status.stderr);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/orgs/acme/projects/checkout/overview'));

    const verification = await runCli([
      'project',
      'verify-widget-installation',
      '--url',
      'https://example.com/product',
      '--env',
      'stage',
      '--json',
    ], env);
    assert.equal(verification.code, 0, verification.stderr);
    assert.ok(requests.some(
      (r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/widget-installation/verify',
    ));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('project create defaults to authenticated personal org handle when omitted', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'GET' && req.url === '/api/user/profile') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 7, email: 'cfg@example.com', name: 'Config User', personal_org_handle: 'cfg-workspace' }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/cfg-workspace/projects') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ project: { id: 'cfg-workspace/demo' } }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');

  const env = {
    ...process.env,
    USERTOLD_API_BASE: `http://127.0.0.1:${addr.port}`,
    USERTOLD_API_KEY: 'token-from-env',
  };

  try {
    const result = await runCli(['project', 'create', '--name', 'Demo', '--json'], env);
    assert.equal(result.code, 0, result.stderr);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/user/profile'));
    const createReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/cfg-workspace/projects');
    assert.equal((createReq?.body as { name?: string })?.name, 'Demo');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
