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
    child.stdout?.on('data', (c) => { stdout += c.toString(); });
    child.stderr?.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('signal commands build filters and mutation payloads correctly', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/signals?type=struggling_moment&target_surface=all&session_id=ses_1&task_id=none&search=checkout&min_confidence=0.7&limit=5&offset=10&dismissed=false') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ signals: [{ id: 'sig_1' }] }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/signals/sig_1') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          signal: {
            id: 'sig_1',
            case_file: {
              case_file_version: 'evidence_case_file.v1',
              evidence_card: {
                contract_version: 'pipeline.v1',
                artifact_kind: 'evidence_card',
                artifact_id: 'sig_1',
                evidence: {
                  signal_type: 'struggling_moment',
                  target_surface: 'product_under_test',
                  quote: 'Checkout stalled',
                  confidence: 0.9,
                  intensity: 0.5,
                  evidence_grade: 'weak',
                  transcript_uncertain: false,
                },
              },
              provenance: null,
              review: {
                review_status: null,
                review_note: null,
                annotation_text: null,
                annotation_by: null,
                annotation_at: null,
                dismissed_at: null,
                dismissed_reason: null,
                dismissed_by: null,
              },
              links: {
                linked_task: null,
                evidence_resolution: null,
                recurrence_candidates: [],
              },
            },
          },
        }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/orgs/acme/projects/checkout/coverage-gaps') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          project_id: 'prj_1',
          gaps: [{
            id: 'published_unlinked_evidence:product_under_test:struggling_moment',
            type: 'published_unlinked_evidence',
            project_id: 'prj_1',
            target_surface: 'product_under_test',
            signal_type: 'struggling_moment',
            summary: '1 published struggling_moment Evidence item on product_under_test has no linked Finding',
            count: 1,
            evidence_ids: ['sig_1'],
            work_ids: [],
            suggested_action: 'Link the published Evidence to an existing Finding or create a reviewed Finding.',
          }],
          totals: {
            published_unlinked_evidence: 1,
            repeated_needs_review_evidence: 0,
            high_confidence_unlinked_evidence: 0,
            work_with_weak_or_no_published_evidence: 0,
          },
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/signals/sig_1/annotate') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/signals/sig_1/dismiss') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/signals/sig_1/link') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/signals/sig_1/unlink') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/signals/sig_1/undismiss') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/orgs/acme/projects/checkout/signals/bulk-link') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ updated: 2, failed: 0 }));
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
      'evidence', 'list', 'acme/checkout',
      '--type', 'struggling_moment',
      '--target-surface', 'all',
      '--interview', 'ses_1',
      '--finding', 'none',
      '--search', 'checkout',
      '--min-confidence', '0.7',
      '--limit', '5',
      '--offset', '10',
      '--json',
    ], env);
    assert.equal(list.code, 0, list.stderr);
    assert.match(list.stdout, /sig_1/);

    const caseFile = await runCli(['evidence', 'case-file', 'acme/checkout', 'sig_1', '--json'], env);
    assert.equal(caseFile.code, 0, caseFile.stderr);
    const caseFilePayload = JSON.parse(caseFile.stdout) as { case_file_version: string; evidence_card: { artifact_id: string } };
    assert.equal(caseFilePayload.case_file_version, 'evidence_case_file.v1');
    assert.equal(caseFilePayload.evidence_card.artifact_id, 'sig_1');

    const coverageGaps = await runCli(['evidence', 'coverage-gaps', 'acme/checkout', '--json'], env);
    assert.equal(coverageGaps.code, 0, coverageGaps.stderr);
    const coveragePayload = JSON.parse(coverageGaps.stdout) as { totals: { published_unlinked_evidence: number }; gaps: Array<{ evidence_ids: string[] }> };
    assert.equal(coveragePayload.totals.published_unlinked_evidence, 1);
    assert.deepEqual(coveragePayload.gaps[0]?.evidence_ids, ['sig_1']);

    const annotate = await runCli(['evidence', 'annotate', 'acme/checkout', 'sig_1', '--text', 'Confirmed by PM', '--json'], env);
    assert.equal(annotate.code, 0, annotate.stderr);

    const dismiss = await runCli(['evidence', 'dismiss', 'acme/checkout', 'sig_1', '--reason', 'duplicate', '--json'], env);
    assert.equal(dismiss.code, 0, dismiss.stderr);

    const link = await runCli(['evidence', 'link', 'acme/checkout', 'sig_1', 'task_1', '--json'], env);
    assert.equal(link.code, 0, link.stderr);

    const unlink = await runCli(['evidence', 'unlink', 'acme/checkout', 'sig_1', '--json'], env);
    assert.equal(unlink.code, 0, unlink.stderr);

    const undismiss = await runCli(['evidence', 'undismiss', 'acme/checkout', 'sig_1', '--json'], env);
    assert.equal(undismiss.code, 0, undismiss.stderr);

    const bulkLink = await runCli(['evidence', 'bulk-link', 'acme/checkout', 'task_2', '--evidence', 'sig_1,sig_2', '--json'], env);
    assert.equal(bulkLink.code, 0, bulkLink.stderr);

    const annotateReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/signals/sig_1/annotate');
    assert.equal((annotateReq?.body as { text?: string })?.text, 'Confirmed by PM');

    const dismissReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/signals/sig_1/dismiss');
    assert.equal((dismissReq?.body as { reason?: string })?.reason, 'duplicate');

    const linkReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/signals/sig_1/link');
    assert.equal((linkReq?.body as { task_id?: string })?.task_id, 'task_1');

    const bulkLinkReq = requests.find((r) => r.method === 'POST' && r.url === '/api/orgs/acme/projects/checkout/signals/bulk-link');
    assert.deepEqual(bulkLinkReq?.body, {
      task_id: 'task_2',
      signal_ids: ['sig_1', 'sig_2'],
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('signal list dismissed filter precedence, delete route, and validation failures', async () => {
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const bodyRaw = Buffer.concat(chunks).toString('utf8');
      const body = bodyRaw ? JSON.parse(bodyRaw) : null;
      requests.push({ method: req.method || 'GET', url: req.url || '/', body });

      if (req.method === 'GET' && req.url?.startsWith('/api/orgs/acme/projects/checkout/signals')) {
        if (req.url.includes('min_confidence=2')) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'Invalid signal query',
              details: [
                { path: 'min_confidence', message: 'Must be <= 1' },
              ],
            },
          }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ signals: [], total: 0, project_total: 0 }));
        return;
      }

      if (req.method === 'DELETE' && req.url === '/api/orgs/acme/projects/checkout/signals/sig_2') {
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
    const listDefault = await runCli(['evidence', 'list', 'acme/checkout', '--json'], env);
    assert.equal(listDefault.code, 0, listDefault.stderr);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url?.endsWith('/signals?dismissed=false')));

    const listDismissed = await runCli(['evidence', 'list', 'acme/checkout', '--dismissed', '--json'], env);
    assert.equal(listDismissed.code, 0, listDismissed.stderr);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url?.endsWith('/signals?dismissed=true')));

    const listAll = await runCli(['evidence', 'list', 'acme/checkout', '--all', '--json'], env);
    assert.equal(listAll.code, 0, listAll.stderr);
    assert.ok(requests.some((r) => r.method === 'GET' && r.url === '/api/orgs/acme/projects/checkout/signals'));

    const deleteCmd = await runCli(['evidence', 'delete', 'acme/checkout', 'sig_2', '--json'], env);
    assert.equal(deleteCmd.code, 0, deleteCmd.stderr);
    assert.ok(requests.some((r) => r.method === 'DELETE' && r.url === '/api/orgs/acme/projects/checkout/signals/sig_2'));

    const invalidQuery = await runCli(['evidence', 'list', 'acme/checkout', '--min-confidence', '2', '--json'], env);
    assert.equal(invalidQuery.code, 1);
    assert.match(invalidQuery.stderr, /Invalid signal query/);

    const annotateMissingText = await runCli(['evidence', 'annotate', 'acme/checkout', 'sig_2', '--json'], env);
    assert.equal(annotateMissingText.code, 2);
    assert.match(annotateMissingText.stderr, /Missing required option: --text/);

    const dismissMissingReason = await runCli(['evidence', 'dismiss', 'acme/checkout', 'sig_2', '--json'], env);
    assert.equal(dismissMissingReason.code, 2);
    assert.match(dismissMissingReason.stderr, /Missing required option: --reason/);

    const bulkMissingSignals = await runCli(['evidence', 'bulk-link', 'acme/checkout', 'task_1', '--json'], env);
    assert.equal(bulkMissingSignals.code, 2);
    assert.match(bulkMissingSignals.stderr, /Missing required option: --evidence/);

    const bulkEmptySignals = await runCli(['evidence', 'bulk-link', 'acme/checkout', 'task_1', '--evidence', ',', '--json'], env);
    assert.equal(bulkEmptySignals.code, 1);
    assert.match(bulkEmptySignals.stderr, /--evidence must contain at least one evidence ID/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
