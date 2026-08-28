import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ACTIVE_TERMS_VERSION } from '../shared/legal-version';

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

async function withCli(fn: (ctx: {
  env: NodeJS.ProcessEnv;
  onboardingBodies: Array<Record<string, unknown>>;
}) => Promise<void>, opts: { needsOrgReview?: boolean } = {}) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-terms-'));
  const cfgDir = path.join(tmpDir, 'usertold-cli');
  await mkdir(cfgDir, { recursive: true });

  const onboardingBodies: Array<Record<string, unknown>> = [];

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/auth/session') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        user: {
          id: 7,
          email: 'cfg@example.com',
          name: 'Config User',
          terms_accepted_version: '2026-02-26',
          terms_accepted_at: '2026-02-26T00:00:00Z',
          needs_terms_acceptance: true,
          needs_org_handle_review: opts.needsOrgReview ?? false,
          needs_onboarding: true,
        },
        config: { googleClientId: 'x', githubClientId: 'y', environment: 'stage' },
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/auth/onboarding') {
      let raw = '';
      req.on('data', (c) => { raw += c.toString(); });
      req.on('end', () => {
        onboardingBodies.push(raw ? JSON.parse(raw) : {});
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          user: {
            id: 7,
            email: 'cfg@example.com',
            name: 'Config User',
            terms_accepted_version: ACTIVE_TERMS_VERSION,
            terms_accepted_at: new Date().toISOString(),
            needs_terms_acceptance: false,
            needs_onboarding: false,
          },
        }));
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  await writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({
    configs: {
      stage: {
        environment: 'stage',
        baseUrl,
        token: { accessToken: 'cfg_token_stage', expiresAt: Date.now() + 60_000 },
        user: { id: 7, name: 'Config User', email: 'cfg@example.com' },
      },
    },
  }), 'utf8');

  const env = { ...process.env, USERTOLD_API_BASE: baseUrl, XDG_CONFIG_HOME: tmpDir };

  try {
    await fn({ env, onboardingBodies });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await rm(tmpDir, { recursive: true, force: true });
  }
}

test('auth terms reviews acceptance status and flags an out-of-date version', async () => {
  await withCli(async ({ env }) => {
    const review = await runCli(['auth', 'terms', '--env', 'stage', '--json'], env);
    assert.equal(review.code, 0, review.stderr);
    const payload = JSON.parse(review.stdout) as {
      acceptedVersion: string; needsAcceptance: boolean; termsUrl: string;
    };
    assert.equal(payload.acceptedVersion, '2026-02-26');
    assert.equal(payload.needsAcceptance, true);
    assert.match(payload.termsUrl, /\/terms$/);
  });
});

test('auth terms accept posts acceptTerms and reports the new version', async () => {
  await withCli(async ({ env, onboardingBodies }) => {
    const accept = await runCli(['auth', 'terms', 'accept', '--env', 'stage'], env);
    assert.equal(accept.code, 0, accept.stderr);
    const payload = JSON.parse(accept.stdout) as { accepted: boolean; acceptedVersion: string };
    assert.equal(payload.accepted, true);
    assert.equal(payload.acceptedVersion, ACTIVE_TERMS_VERSION);
    assert.equal(onboardingBodies.length, 1);
    assert.equal(onboardingBodies[0].acceptTerms, true);
  });
});

test('auth terms accept refuses when the workspace also needs review (no silent gate bypass)', async () => {
  await withCli(async ({ env, onboardingBodies }) => {
    const accept = await runCli(['auth', 'terms', 'accept', '--env', 'stage'], env);
    assert.equal(accept.code, 1, accept.stdout);
    assert.match(accept.stderr, /workspace also needs review/);
    // Must NOT have posted acceptTerms — that would silently complete org review.
    assert.equal(onboardingBodies.length, 0);
  }, { needsOrgReview: true });
});

test('auth terms rejects an unknown subcommand', async () => {
  await withCli(async ({ env }) => {
    const bad = await runCli(['auth', 'terms', 'bogus', '--env', 'stage'], env);
    assert.equal(bad.code, 1, bad.stdout);
    assert.match(bad.stderr, /Unknown terms command/);
  });
});
