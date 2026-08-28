import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { buildInitHumanOutput } from './commands/init';
import { resolveStudyPlacement, StudyVisibilitySchema } from '../shared/study-placement';

type CliRunResult = { code: number | null; stdout: string; stderr: string };

test('init human output prints readable refs without opaque entity IDs', () => {
  const output = buildInitHumanOutput({
    study: { ref: 'guided-self-test' },
    intake: { ref: 'guided-self-test-intake' },
  }, 'acme/demo', 'ut_pub_demo', '<script data-project-key="ut_pub_demo"></script>').join('\n');

  assert.match(output, /Project:\s+acme\/demo/);
  assert.match(output, /Study:\s+guided-self-test/);
  assert.match(output, /Intake:\s+guided-self-test-intake/);
  assert.doesNotMatch(output, /\b(?:prj|sty|scr)_[a-z0-9_]+\b|undefined/);
});

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

test('init creates project, stores settings, creates study (auto-creates intake), and outputs widget snippet', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({
        method: req.method || 'GET',
        url: req.url || '/',
        body,
      });

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          project: {
            id: 'prj_1',
            public_key: 'ut_pub_1',
            org_handle: 'acme',
            project_handle: 'checkout',
          },
        }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/settings') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/studies') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          study: { id: 'sty_1', handle: 'user-research-study' },
          intake_auto_created: true,
          intake_ref: 'user-research-intake',
        }));
        return;
      }

      if (req.method === 'PATCH' && req.url?.startsWith('/api/orgs/acme/projects/checkout/studies/user-research-study')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ study: { id: 'sty_1', status: 'active' }, intake_status_changed: true }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
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
    const result = await runCli([
      'init',
      '--name', 'Demo Project',
      '--org', 'acme',
      '--yes',
      '--openai-key', 'sk-test-key',
      '--env', 'stage',
      '--json',
    ], env);

    assert.equal(result.code, 0, result.stderr);

    const payload = JSON.parse(result.stdout) as {
      project: { ref: string; public_key: string };
      study: { ref: string; title: string };
      intake: { ref: string };
      widget_snippet: string;
    };

    assert.equal(payload.project.ref, 'acme/checkout');
    assert.equal(payload.project.public_key, 'ut_pub_1');
    assert.equal(payload.study.ref, 'user-research-study');
    assert.equal(payload.intake.ref, 'user-research-intake');
    assert.match(payload.widget_snippet, /widget\.js/);
    assert.match(payload.widget_snippet, /ut_pub_1/);
    assert.match(payload.widget_snippet, /data-project-key="ut_pub_1"/);
    assert.doesNotMatch(payload.widget_snippet, /data-study-ref/);

    // Verify study was created and activated
    const studyCreate = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/studies');
    assert.ok(studyCreate);
    assert.equal((studyCreate.body as { title: string }).title, 'User Research Study');
    assert.deepEqual((studyCreate.body as { visibility: unknown }).visibility, {
      version: 1,
      enabled: true,
      rules: [],
      priority: 0,
      order: 0,
    });
    assert.deepEqual(resolveStudyPlacement([{
      study_ref: 'user-research-study',
      visibility: StudyVisibilitySchema.parse((studyCreate.body as { visibility: unknown }).visibility),
    }], { pathname: '/any-page', language: 'en' }), { outcome: 'match', study_ref: 'user-research-study' });

    const studyActivate = requests.find((r) => r.method === 'PATCH' && r.url?.startsWith('/api/orgs/acme/projects/checkout/studies/user-research-study'));
    assert.ok(studyActivate);
    assert.equal((studyActivate.body as { status: string }).status, 'active');

    const openaiPatch = requests.find((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/settings' && (r.body as { openai_api_key?: string })?.openai_api_key);
    assert.ok(openaiPatch);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('init creates and activates a study without configuring an OpenAI key', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({
        method: req.method || 'GET',
        url: req.url || '/',
        body,
      });

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          project: {
            id: 'prj_no_key',
            public_key: 'ut_pub_no_key',
            org_handle: 'acme',
            project_handle: 'no-key',
          },
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/no-key/studies') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          study: { id: 'sty_no_key', handle: 'user-research-study' },
          intake_auto_created: true,
          intake_ref: 'user-research-intake',
        }));
        return;
      }

      if (req.method === 'PATCH' && req.url?.startsWith('/api/orgs/acme/projects/no-key/studies/user-research-study')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ study: { id: 'sty_no_key', status: 'active' }, intake_status_changed: true }));
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
    const result = await runCli([
      'init',
      '--name', 'No Key Project',
      '--org', 'acme',
      '--yes',
      '--env', 'stage',
      '--json',
    ], env);

    assert.equal(result.code, 0, result.stderr);

    const payload = JSON.parse(result.stdout) as {
      project: { ref: string; public_key: string };
      study: { ref: string; title: string };
      intake: { ref: string };
      widget_snippet: string;
    };

    assert.equal(payload.project.ref, 'acme/no-key');
    assert.equal(payload.project.public_key, 'ut_pub_no_key');
    assert.equal(payload.study.ref, 'user-research-study');
    assert.equal(payload.intake.ref, 'user-research-intake');
    assert.match(payload.widget_snippet, /widget\.js/);
    assert.match(payload.widget_snippet, /ut_pub_no_key/);
    assert.match(payload.widget_snippet, /data-project-key="ut_pub_no_key"/);
    assert.doesNotMatch(payload.widget_snippet, /data-study-ref/);
    assert.equal(requests.some((r) => r.url === '/api/orgs/acme/projects/no-key/settings'), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('init defaults to authenticated personal org handle when --org is omitted', async () => {
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
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          project: {
            id: 'prj_1',
            public_key: 'ut_pub_1',
            org_handle: 'cfg-workspace',
            project_handle: 'demo-project',
          },
        }));
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
    const result = await runCli([
      'init',
      '--name', 'Demo Project',
      '--json',
    ], env);

    assert.equal(result.code, 0, result.stderr);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/user/profile'));
    assert.ok(requests.some((r) => r.method === 'POST' && r.url === '/api/orgs/cfg-workspace/projects'));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
