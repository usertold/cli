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
    child.stdout?.on('data', (c) => { stdout += c.toString(); });
    child.stderr?.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('intake list/get/update/delete/responses cover CRUD', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/intakes') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ intakes: [{ ref: 'onboarding', handle: 'onboarding', status: 'draft' }] }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          intake: { ref: 'onboarding', handle: 'onboarding', title: 'Onboarding', status: 'active' },
          questions: [{ id: 'q_1', question_text: 'Role?', sort_order: 0 }],
        }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ intake: { ref: 'onboarding', ...(body as object) } }));
        return;
      }

      if (req.method === 'DELETE' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding/responses/resp_1') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: { id: 'resp_1', qualified: null } }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding/responses/resp_1') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ response: { id: 'resp_1', ...(body as object) } }));
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
    const list = await runCli(['intake', 'list', 'acme/checkout', '--json'], env);
    assert.equal(list.code, 0, list.stderr);
    const listPayload = JSON.parse(list.stdout) as { intakes: { ref: string }[] };
    assert.equal(listPayload.intakes.length, 1);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/orgs/acme/projects/checkout/intakes'));

    // get
    const get = await runCli(['intake', 'get', 'acme/checkout', 'onboarding', '--json'], env);
    assert.equal(get.code, 0, get.stderr);
    const getPayload = JSON.parse(get.stdout) as { intake: { handle: string } };
    assert.equal(getPayload.intake.handle, 'onboarding');

    // update (including status change)
    const update = await runCli([
      'intake', 'update', 'acme/checkout', 'onboarding',
      '--title', 'Updated Screener',
      '--status', 'active',
      '--max-participants', '100',
      '--json',
    ], env);
    assert.equal(update.code, 0, update.stderr);
    const updateReq = requests.find((r) =>
      r.method === 'PATCH' &&
      r.url === '/api/orgs/acme/projects/checkout/intakes/onboarding' &&
      (r.body as { title?: string })?.title === 'Updated Screener',
    );
    assert.ok(updateReq, 'update sends PATCH with correct fields');
    assert.equal((updateReq?.body as { status?: string })?.status, 'active');
    assert.equal((updateReq?.body as { max_participants?: number })?.max_participants, 100);

    // update with no fields fails
    const updateEmpty = await runCli(['intake', 'update', 'acme/checkout', 'onboarding', '--json'], env);
    assert.notEqual(updateEmpty.code, 0);
    assert.match(updateEmpty.stderr, /No update fields provided/);

    // delete
    const del = await runCli(['intake', 'delete', 'acme/checkout', 'onboarding', '--json'], env);
    assert.equal(del.code, 0, del.stderr);
    const delPayload = JSON.parse(del.stdout) as { success: boolean };
    assert.equal(delPayload.success, true);

    // get-response
    const getResp = await runCli(['intake', 'get-response', 'acme/checkout', 'onboarding', 'resp_1', '--json'], env);
    assert.equal(getResp.code, 0, getResp.stderr);
    const getRespPayload = JSON.parse(getResp.stdout) as { response: { id: string } };
    assert.equal(getRespPayload.response.id, 'resp_1');

    // qualify-response
    const qualify = await runCli(['intake', 'qualify-response', 'acme/checkout', 'onboarding', 'resp_1', '--reason', 'Fits criteria', '--json'], env);
    assert.equal(qualify.code, 0, qualify.stderr);
    const qualifyReq = requests.find((r) =>
      r.method === 'PATCH' &&
      r.url === '/api/orgs/acme/projects/checkout/intakes/onboarding/responses/resp_1' &&
      (r.body as { qualified?: boolean })?.qualified === true,
    );
    assert.ok(qualifyReq, 'qualify sends PATCH with qualified:true');
    assert.equal((qualifyReq?.body as { reason?: string })?.reason, 'Fits criteria');

    // disqualify-response (requires --reason)
    const disqualify = await runCli(['intake', 'disqualify-response', 'acme/checkout', 'onboarding', 'resp_1', '--reason', 'Not a match', '--json'], env);
    assert.equal(disqualify.code, 0, disqualify.stderr);
    const disqualifyReq = requests.find((r) =>
      r.method === 'PATCH' &&
      r.url === '/api/orgs/acme/projects/checkout/intakes/onboarding/responses/resp_1' &&
      (r.body as { qualified?: boolean })?.qualified === false,
    );
    assert.ok(disqualifyReq, 'disqualify sends PATCH with qualified:false');
    assert.equal((disqualifyReq?.body as { reason?: string })?.reason, 'Not a match');

    // disqualify-response without --reason should fail
    const disqualifyNoReason = await runCli(['intake', 'disqualify-response', 'acme/checkout', 'onboarding', 'resp_1', '--json'], env);
    assert.notEqual(disqualifyNoReason.code, 0);
    assert.match(disqualifyNoReason.stderr, /Missing required option: --reason/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('intake create with --activate and set-questions', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-screener-'));
  const questionsFile = path.join(tmpDir, 'questions.json');
  const questions = [
    { question_text: 'What are you trying to do?', question_type: 'text', required: true },
    { question_text: 'How often?', question_type: 'single_choice', options: ['daily', 'weekly'] },
  ];
  await writeFile(questionsFile, JSON.stringify(questions), 'utf8');

  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/intakes') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ intake: { ref: 'onboarding', handle: 'onboarding' } }));
        return;
      }

      if (req.method === 'PATCH' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'PUT' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding/questions') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ questions: [{ id: 'q_1' }, { id: 'q_2' }] }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/intakes/onboarding') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ intake: { ref: 'onboarding' }, questions: [], responses: [{ id: 'resp_1' }] }));
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
      'intake', 'create', 'acme/checkout',
      '--title', 'Onboarding Screener',
      '--questions', `@${questionsFile}`,
      '--activate',
      '--json',
    ], env);
    assert.equal(create.code, 0, create.stderr);

    const createReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/intakes');
    assert.equal((createReq?.body as { title?: string })?.title, 'Onboarding Screener');
    assert.equal(((createReq?.body as { questions?: unknown[] })?.questions ?? []).length, 2);

    const activateReq = requests.find((r) => r.method === 'PATCH' && r.url === '/api/orgs/acme/projects/checkout/intakes/onboarding');
    assert.ok(activateReq, 'create --activate sends PATCH with status:active');
    assert.equal((activateReq?.body as { status?: string })?.status, 'active');

    // set-questions replaces all questions atomically
    const setQuestions = await runCli([
      'intake', 'set-questions', 'acme/checkout', 'onboarding',
      '--questions', `@${questionsFile}`,
      '--json',
    ], env);
    assert.equal(setQuestions.code, 0, setQuestions.stderr);

    const setQReq = requests.find((r) => r.method === 'PUT' && r.url === '/api/orgs/acme/projects/checkout/intakes/onboarding/questions');
    assert.ok(setQReq, 'set-questions sends PUT to /questions');
    assert.equal(((setQReq?.body as { questions?: unknown[] })?.questions ?? []).length, 2);

    // list-responses via get
    const responses = await runCli(['intake', 'list-responses', 'acme/checkout', 'onboarding', '--json'], env);
    assert.equal(responses.code, 0, responses.stderr);
    assert.match(responses.stdout, /resp_1/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(tmpDir, { recursive: true, force: true });
  }
});
