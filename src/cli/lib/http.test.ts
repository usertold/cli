import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { requestRaw, requestJson, HttpError } from './http';
import { CliError } from './errors';
import { buildCliUserAgent } from './user-agent';
import { runWithDryRunProtection } from './dry-run';

const originalFetch = globalThis.fetch;

async function withTempConfigHome(fn: (tmpDir: string) => Promise<void>) {
  const prev = process.env.XDG_CONFIG_HOME;
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-http-'));
  process.env.XDG_CONFIG_HOME = tmpDir;

  try {
    await fn(tmpDir);
  } finally {
    if (prev === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = prev;
    }
    await rm(tmpDir, { recursive: true, force: true });
  }
}

test('requestRaw sends method/headers/body and parses json response', async () => {
  process.env.USERTOLD_API_KEY = 'env-token';
  process.env.USERTOLD_API_BASE = 'https://api.example.test';

  let captured: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = async (input, init) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const res = await requestRaw({
    env: 'stage',
    method: 'post',
    path: 'api/projects',
    body: { name: 'Demo' },
    headers: { 'x-extra': '1' },
    projectKey: 'pk_1',
  });

  const c = captured as unknown as { url: string; init?: RequestInit };
  assert.equal(c.url, 'https://api.example.test/api/projects');
  assert.equal((c.init!.headers as Record<string, string>).authorization, 'Bearer env-token');
  assert.equal((c.init!.headers as Record<string, string>)['X-Project-Key'], 'pk_1');
  assert.equal((c.init!.headers as Record<string, string>)['content-type'], 'application/json');
  assert.equal((c.init!.headers as Record<string, string>)['user-agent'], buildCliUserAgent());
  assert.deepEqual(res.json, { ok: true });

  delete process.env.USERTOLD_API_KEY;
  delete process.env.USERTOLD_API_BASE;
  globalThis.fetch = originalFetch;
});

test('dry-run protection blocks mutation methods before fetch', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200 });
  };

  await assert.rejects(
    () => runWithDryRunProtection(true, () => requestRaw({
      env: 'stage',
      method: 'PATCH',
      path: '/api/studies/example',
      authMode: 'none',
      body: { title: 'Planned title' },
    })),
    /Dry-run safety contract blocked side effect: HTTP PATCH/,
  );
  assert.equal(fetchCalled, false);
  globalThis.fetch = originalFetch;
});

test('requestRaw authMode none skips auth and parses non-json text', async () => {
  process.env.USERTOLD_API_BASE = 'https://api.example.test';
  globalThis.fetch = async () => new Response('plain text response', { status: 200 });

  const res = await requestRaw({ env: 'stage', method: 'GET', path: '/ok', authMode: 'none' });

  assert.equal(res.text, 'plain text response');
  assert.equal(res.json, null);

  delete process.env.USERTOLD_API_BASE;
  globalThis.fetch = originalFetch;
});

test('requestRaw throws auth error when required auth has no env/config token', async () => {
  delete process.env.USERTOLD_API_KEY;
  process.env.USERTOLD_API_BASE = 'https://api.example.test';

  await withTempConfigHome(async () => {
    await assert.rejects(
      () => requestRaw({ env: 'stage', method: 'GET', path: '/api/projects' }),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        assert.match(err.message, /Not authenticated for environment/);
        return true;
      },
    );
  });

  delete process.env.USERTOLD_API_BASE;
});

test('requestRaw optional auth continues with expired config and local env sets NODE_TLS_REJECT_UNAUTHORIZED', async () => {
  delete process.env.USERTOLD_API_KEY;
  process.env.USERTOLD_API_BASE = 'https://local.example.test';

  await withTempConfigHome(async (tmpDir) => {
    const cfgDir = path.join(tmpDir, 'usertold-cli');
    await mkdir(cfgDir, { recursive: true });
    await writeFile(path.join(cfgDir, 'config.json'), JSON.stringify({
      configs: {
        local: {
          environment: 'local',
          baseUrl: 'https://ignored.example.test',
          token: { accessToken: 'expired', expiresAt: Date.now() - 1000 },
        },
      },
    }), 'utf8');

    globalThis.fetch = async () => new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const res = await requestRaw({ env: 'local', method: 'GET', path: '/api/ping', authMode: 'optional' });
    assert.equal(res.ok, true);
    assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, '0');
  });

  delete process.env.USERTOLD_API_BASE;
  globalThis.fetch = originalFetch;
});

test('requestJson returns parsed json or text and maps error details to HttpError', async () => {
  process.env.USERTOLD_API_KEY = 'env-token';
  process.env.USERTOLD_API_BASE = 'https://api.example.test';

  let mode: 'json-ok' | 'text-ok' | 'json-error' | 'text-error' | 'onboarding-required' | 'onboarding-hint-only-org' | 'onboarding-required-generic' | 'onboarding-terms-code-field' = 'json-ok';
  globalThis.fetch = async () => {
    switch (mode) {
      case 'json-ok':
        return new Response(JSON.stringify({ id: '1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      case 'text-ok':
        return new Response('hello', { status: 200 });
      case 'json-error':
        return new Response(JSON.stringify({ error: 'denied' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      case 'text-error':
        return new Response('boom', { status: 500 });
      case 'onboarding-required':
        return new Response(JSON.stringify({
          error_code: 'onboarding_required',
          needs_onboarding: true,
          needs_terms_acceptance: true,
          needs_org_handle_review: true,
        }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      case 'onboarding-hint-only-org':
        return new Response(JSON.stringify({
          error_code: 'onboarding_required',
          needs_onboarding: true,
          needs_terms_acceptance: false,
          needs_org_handle_review: true,
        }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      case 'onboarding-required-generic':
        return new Response(JSON.stringify({
          error_code: 'onboarding_required',
          needs_onboarding: true,
          needs_terms_acceptance: false,
          needs_org_handle_review: false,
        }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      case 'onboarding-terms-code-field':
        // The real auth-middleware payload uses `code`/`error`, not `error_code`.
        return new Response(JSON.stringify({
          error: 'onboarding_required',
          code: 'onboarding_required',
          needs_onboarding: true,
          needs_terms_acceptance: true,
          needs_org_handle_review: false,
          onboarding_path: '/onboarding',
        }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
    }
  };

  const json = await requestJson<{ id: string }>({ env: 'stage', method: 'GET', path: '/json' });
  assert.equal(json.id, '1');

  mode = 'text-ok';
  const text = await requestJson<string>({ env: 'stage', method: 'GET', path: '/text' });
  assert.equal(text, 'hello');

  mode = 'json-error';
  await assert.rejects(
    () => requestJson({ env: 'stage', method: 'GET', path: '/err-json' }),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 403);
      assert.equal(err.exitCode, 3);
      assert.match(err.message, /denied/);
      return true;
    },
  );

  mode = 'text-error';
  await assert.rejects(
    () => requestJson({ env: 'stage', method: 'GET', path: '/err-text' }),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 500);
      assert.match(err.message, /boom/);
      return true;
    },
  );

  mode = 'onboarding-required';
  await assert.rejects(
    () => requestJson({ env: 'stage', method: 'GET', path: '/err-onboarding' }),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 403);
      // When terms acceptance is needed, the message points to the CLI fix.
      assert.match(err.message, /Terms of Service have changed/);
      assert.match(err.message, /usertold auth terms accept/);
      return true;
    },
  );

  mode = 'onboarding-hint-only-org';
  await assert.rejects(
    () => requestJson({ env: 'stage', method: 'GET', path: '/err-onboarding-org' }),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 403);
      assert.match(err.message, /organization handle\/name needs review/);
      return true;
    },
  );

  mode = 'onboarding-required-generic';
  await assert.rejects(
    () => requestJson({ env: 'stage', method: 'GET', path: '/err-onboarding-generic' }),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 403);
      assert.match(err.message, /HTTP 403: Onboarding required\./);
      return true;
    },
  );

  // Regression: the auth-middleware gate sends `code`/`error` (not `error_code`).
  // A terms change must still surface an actionable, terms-specific message.
  mode = 'onboarding-terms-code-field';
  await assert.rejects(
    () => requestJson({ env: 'stage', method: 'GET', path: '/err-onboarding-terms' }),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 403);
      assert.match(err.message, /Terms of Service have changed/);
      assert.match(err.message, /usertold auth terms accept/);
      return true;
    },
  );

  delete process.env.USERTOLD_API_KEY;
  delete process.env.USERTOLD_API_BASE;
  globalThis.fetch = originalFetch;
});

test('requestJson retries configured transient responses and eventually succeeds', async () => {
  process.env.USERTOLD_API_KEY = 'env-token';
  process.env.USERTOLD_API_BASE = 'https://api.example.test';

  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;

    if (attempts === 1) {
      return new Response('slow down', {
        status: 429,
        headers: { 'Retry-After': '0.001' },
      });
    }

    if (attempts === 2) {
      return new Response('temporary upstream failure', { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await requestJson<{ ok: boolean }>(
    { env: 'stage', method: 'POST', path: '/push' },
    {
      retries: 3,
      initialDelayMs: 1,
      maxDelayMs: 4,
      shouldRetry: ({ response }) => Boolean(response && (response.status === 429 || response.status >= 500)),
    },
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(attempts, 3);

  delete process.env.USERTOLD_API_KEY;
  delete process.env.USERTOLD_API_BASE;
  globalThis.fetch = originalFetch;
});

test('requestJson collapses Cloudflare 1010 pages into an actionable error', async () => {
  process.env.USERTOLD_API_KEY = 'env-token';
  process.env.USERTOLD_API_BASE = 'https://api.example.test';

  globalThis.fetch = async () => new Response(`
    <html>
      <body>
        <h1>Access denied</h1>
        <p>Error code: 1010</p>
        <p>banned your access based on your browser's signature</p>
      </body>
    </html>
  `, {
    status: 403,
    headers: { 'content-type': 'text/html' },
  });

  await assert.rejects(
    () => requestJson({ env: 'stage', method: 'POST', path: '/push' }),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 403);
      assert.match(err.message, /Cloudflare blocked this request \(error 1010\)/);
      return true;
    },
  );

  delete process.env.USERTOLD_API_KEY;
  delete process.env.USERTOLD_API_BASE;
  globalThis.fetch = originalFetch;
});
