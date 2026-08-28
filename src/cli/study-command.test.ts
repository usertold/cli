import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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

test('study resolve help documents ranking and the default language', async () => {
  const result = await runCli(['study', 'resolve', '--help'], process.env);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Exclusions, route specificity, and language specificity apply first/);
  assert.match(result.stdout, /higher Priority/);
  assert.match(result.stdout, /lower Project order/);
  assert.match(result.stdout, /final tie fails closed/);
  assert.match(result.stdout, /Defaults to en/);
});

test('study create/import/guide flows are wired correctly', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-study-'));
  const scriptPath = path.join(tmpDir, 'script.json');
  await writeFile(scriptPath, JSON.stringify({ segments: [{ id: 's1', mode: 'talk', title: 'Intro' }] }), 'utf8');

  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  const guideMarkdown = [
    '# Study Design Guide',
    '',
    '## Script Structure',
    'Use clear segment transitions.',
    '',
    '## Goals',
    'Start from decisions, not questions.',
    '',
  ].join('\n');

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/studies') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          study: {
            id: 'sty_internal',
            handle: 'checkout-research',
            status: 'draft',
          },
        }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/studies/checkout-research') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'GET' && req.url === '/guides/study-design.md') {
        res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' });
        res.end(guideMarkdown);
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
    // Create study with a title, then activate it.
    const create = await runCli([
      'study', 'create', 'acme/checkout',
      '--title', 'Checkout Research',
      '--invitation', '{"launcher":{"label":"Share feedback","icon":"feedback"},"presentation_mode":"passive","brand_color":{"light":"#8b5cf6"},"placement":{"desktop":"bottom-right","mobile":"bottom-left"}}',
      '--visibility', '{"version":1,"enabled":true,"rules":[],"priority":0,"order":0}',
      '--activate',
      '--json',
    ], env);
    assert.equal(create.code, 0, create.stderr);

    const createReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/studies');
    assert.equal((createReq?.body as { title?: string })?.title, 'Checkout Research');
    assert.deepEqual((createReq?.body as { invitation?: unknown })?.invitation, {
      launcher: { label: 'Share feedback', icon: 'feedback' }, presentation_mode: 'passive',
      brand_color: { light: '#8b5cf6' },
      placement: { desktop: 'bottom-right', mobile: 'bottom-left' },
    });
    assert.deepEqual((createReq?.body as { visibility?: unknown })?.visibility, { version: 1, enabled: true, rules: [], priority: 0, order: 0 });

    const activateReq = requests.find((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/studies/checkout-research' && (r.body as { status?: string })?.status === 'active');
    assert.ok(activateReq);
    assert.doesNotMatch(create.stdout, /sty_internal/);
    assert.equal((JSON.parse(create.stdout) as { study: { ref: string } }).study.ref, 'checkout-research');

    // Import script from file
    const importCmd = await runCli([
      'study', 'import', 'acme/checkout', 'checkout-research',
      '--script', `@${scriptPath}`,
      '--json',
    ], env);
    assert.equal(importCmd.code, 0, importCmd.stderr);

    const importReq = requests.filter((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/studies/checkout-research').at(-1);
    assert.equal((importReq?.body as { script?: { segments?: unknown[] } })?.script?.segments?.length, 1);

    // Guide prints without error
    const guide = await runCli(['study', 'guide'], env);
    assert.equal(guide.code, 0, guide.stderr);
    assert.match(guide.stdout, /Study Design Guide/);
    assert.match(guide.stdout, /Use clear segment transitions\./);

    const guideReq = requests.find((r) => r.method === 'GET' && r.url === '/guides/study-design.md');
    assert.ok(guideReq);

    const section = await runCli(['study', 'guide', '--section', 'script structure'], env);
    assert.equal(section.code, 0, section.stderr);
    assert.match(section.stdout, /^## Script Structure/m);
    assert.doesNotMatch(section.stdout, /^## Goals/m);

    const json = await runCli(['study', 'guide', '--format', 'json'], env);
    assert.equal(json.code, 0, json.stderr);
    const parsed = JSON.parse(json.stdout) as { content: string };
    assert.match(parsed.content, /Study Design Guide/);

    const missingSection = await runCli(['study', 'guide', '--section', 'Not Real'], env);
    assert.equal(missingSection.code, 1);
    assert.match(missingSection.stderr, /Section "Not Real" not found\. Available: Script Structure, Goals/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('study list/get/delete cover remaining CRUD operations', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/studies') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ studies: [{ id: 'std_1', title: 'Checkout Study', status: 'draft' }] }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/studies/std_1') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ study: { id: 'std_1', title: 'Checkout Study', status: 'draft', recruitment_url: 'https://app.example.com/checkout?ut_research=rct_0123456789abcdefghijklmn' } }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/studies/resolve-preview') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ outcome: 'match', study_ref: 'std_1' }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/studies/std_1') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ study: { id: 'std_1', status: (body as { status?: string })?.status ?? 'draft' } }));
        return;
      }

      if (req.method === 'DELETE' && req.url === '/api/orgs/acme/projects/checkout/studies/std_1') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
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
    // list
    const list = await runCli(['study', 'list', 'acme/checkout', '--json'], env);
    assert.equal(list.code, 0, list.stderr);
    const listPayload = JSON.parse(list.stdout) as { studies: { id: string }[] };
    assert.equal(listPayload.studies.length, 1);
    assert.equal(listPayload.studies[0].id, 'std_1');
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/orgs/acme/projects/checkout/studies'));

    // get
    const get = await runCli(['study', 'get', 'acme/checkout', 'std_1', '--json'], env);
    assert.equal(get.code, 0, get.stderr);
    const getPayload = JSON.parse(get.stdout) as { study: { id: string; study_type?: string; recruitment_url?: string } };
    assert.equal(getPayload.study.id, 'std_1');
    assert.equal(getPayload.study.study_type, undefined);
    assert.equal(getPayload.study.recruitment_url, 'https://app.example.com/checkout?ut_research=rct_0123456789abcdefghijklmn');
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/orgs/acme/projects/checkout/studies/std_1'));

    // activate via update --status active
    const activate = await runCli(['study', 'update', 'acme/checkout', 'std_1', '--status', 'active', '--json'], env);
    assert.equal(activate.code, 0, activate.stderr);
    const activateReq = requests.find((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/studies/std_1');
    assert.deepEqual((activateReq?.body as { status?: string })?.status, 'active');

    const resetAppearance = await runCli(['study', 'update', 'acme/checkout', 'std_1', '--invitation', 'null', '--visibility', 'null', '--json'], env);
    assert.equal(resetAppearance.code, 0, resetAppearance.stderr);
    const resetReq = requests.filter((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/studies/std_1').at(-1);
    assert.equal((resetReq?.body as { invitation?: unknown })?.invitation, null);
    assert.equal((resetReq?.body as { visibility?: unknown })?.visibility, null);

    const preview = await runCli(['study', 'resolve', 'acme/checkout', '--path', '/checkout', '--language', 'de', '--json'], env);
    assert.equal(preview.code, 0, preview.stderr);
    assert.deepEqual(JSON.parse(preview.stdout), { outcome: 'match', study_ref: 'std_1' });
    const previewReq = requests.find((r) => r.url === '/api/orgs/acme/projects/checkout/studies/resolve-preview');
    assert.deepEqual(previewReq?.body, { pathname: '/checkout', language: 'de' });

    // Regression: update --dry-run must return the planned fields without
    // reaching the PATCH transport that previously changed production.
    const mutationsBeforeDryRun = requests.filter((r) => ['PATCH', 'POST', 'PUT', 'DELETE'].includes(r.method)).length;
    const dryRun = await runCli([
      'study', 'update', 'acme/checkout', 'std_1',
      '--title', 'Planned title',
      '--status', 'active',
      '--dry-run',
      '--json',
    ], env);
    assert.equal(dryRun.code, 0, dryRun.stderr);
    assert.deepEqual(JSON.parse(dryRun.stdout), {
      dry_run: true,
      command: 'study update',
      operation: 'write',
      environment: 'production',
      arguments: { projectRef: 'acme/checkout', studyRef: 'std_1' },
      options: { title: 'Planned title', status: 'active' },
    });
    assert.equal(
      requests.filter((r) => ['PATCH', 'POST', 'PUT', 'DELETE'].includes(r.method)).length,
      mutationsBeforeDryRun,
    );

    const humanDryRun = await runCli([
      'study', 'update', 'acme/checkout', 'std_1', '--title', 'Planned title', '--dry-run',
    ], env);
    assert.equal(humanDryRun.code, 0, humanDryRun.stderr);
    assert.match(humanDryRun.stdout, /Dry run: no changes were made\./);
    assert.match(humanDryRun.stdout, /title: Planned title/);
    assert.equal(
      requests.filter((r) => ['PATCH', 'POST', 'PUT', 'DELETE'].includes(r.method)).length,
      mutationsBeforeDryRun,
    );

    // delete
    const del = await runCli(['study', 'delete', 'acme/checkout', 'std_1', '--dry-run=false', '--json'], env);
    assert.equal(del.code, 0, del.stderr);
    const delPayload = JSON.parse(del.stdout) as { success: boolean };
    assert.equal(delPayload.success, true);
    assert.ok(requests.some((r) => r.method === 'DELETE' && r.url === '/api/orgs/acme/projects/checkout/studies/std_1'));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('study create/update map payload fields and validation failures are surfaced', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-study-payloads-'));
  const scriptPath = path.join(tmpDir, 'script.json');
  await writeFile(
    scriptPath,
    JSON.stringify({ segments: [{ id: 'seg_intro', mode: 'talk', title: 'Intro' }] }),
    'utf8',
  );

  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/studies') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ study: { id: 'std_2', status: 'draft' } }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/studies/std_2') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ study: { id: 'std_2' } }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/studies/std_2/review-script') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ summary: { issues: 0 } }));
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
    const create = await runCli([
      'study', 'create', 'acme/checkout',
      '--title', 'Checkout Study',
      '--handle', 'checkout-q1',
      '--description', 'Focus on abandonment',
      '--intake', 'screening-v1',
      '--goals', '[{"id":"g1","description":"Reduce abandonments"}]',
      '--script', `@${scriptPath}`,
      '--allowed-origins', 'https://a.com, https://b.com',
      '--json',
    ], env);
    assert.equal(create.code, 0, create.stderr);

    const createReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/studies');
    assert.deepEqual(createReq?.body, {
      title: 'Checkout Study',
      handle: 'checkout-q1',
      description: 'Focus on abandonment',
      intake_ref: 'screening-v1',
      goals: [{ id: 'g1', description: 'Reduce abandonments' }],
      script: { segments: [{ id: 'seg_intro', mode: 'talk', title: 'Intro' }] },
      allowed_origins: ['https://a.com', 'https://b.com'],
    });

    const update = await runCli([
      'study', 'update', 'acme/checkout', 'std_2',
      '--status', 'paused',
      '--goals', '[{"id":"g2","description":"Improve completion"}]',
      '--allowed-origins', 'https://learnspeakrepeat.com',
      '--json',
    ], env);
    assert.equal(update.code, 0, update.stderr);

    const updateReq = requests.find((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/studies/std_2');
    assert.deepEqual(updateReq?.body, {
      status: 'paused',
      goals: [{ id: 'g2', description: 'Improve completion' }],
      allowed_origins: ['https://learnspeakrepeat.com'],
    });

    // Clear origins with empty string
    const clear = await runCli([
      'study', 'update', 'acme/checkout', 'std_2',
      '--allowed-origins=',
      '--json',
    ], env);
    assert.equal(clear.code, 0, clear.stderr);
    const clearReq = requests.filter((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/studies/std_2').at(-1);
    assert.deepEqual(clearReq?.body, { allowed_origins: [] });

    const review = await runCli([
      'study', 'validate-script', 'acme/checkout', 'std_2',
      '--script', `@${scriptPath}`,
      '--json',
    ], env);
    assert.equal(review.code, 0, review.stderr);

    const reviewReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/studies/std_2/review-script');
    assert.deepEqual(reviewReq?.body, {
      script: { segments: [{ id: 'seg_intro', mode: 'talk', title: 'Intro' }] },
    });

    const updateNoFields = await runCli(['study', 'update', 'acme/checkout', 'std_2', '--json'], env);
    assert.equal(updateNoFields.code, 1);
    assert.match(updateNoFields.stderr, /No update fields provided/);

    const importMissingScript = await runCli(['study', 'import', 'acme/checkout', 'std_2', '--json'], env);
    assert.equal(importMissingScript.code, 2);
    assert.match(importMissingScript.stderr, /Missing required option: --script/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(tmpDir, { recursive: true, force: true });
  }
});
