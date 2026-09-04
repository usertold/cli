import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent, createServer, get, type IncomingMessage, type ServerResponse } from 'node:http';
import { fetchOidcConfiguration, exchangeCodeForToken, startAuthorizationCodeListener } from './auth';

async function listenServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  return {
    port: address.port,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function countAgentSockets(agent: Agent): number {
  return [...Object.values(agent.sockets), ...Object.values(agent.freeSockets)]
    .reduce((count, sockets) => count + (sockets?.length ?? 0), 0);
}

test('fetchOidcConfiguration returns parsed JSON and throws on HTTP errors', async () => {
  const okServer = await listenServer((req, res) => {
    if (req.url === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ issuer: 'http://127.0.0.1', authorization_endpoint: 'http://127.0.0.1/auth' }));
      return;
    }
    res.writeHead(404).end();
  });
  const badServer = await listenServer((_req, res) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'down' }));
  });

  try {
    const baseUrl = `http://127.0.0.1:${okServer.port}`;
    const cfg = await fetchOidcConfiguration(baseUrl, true);
    assert.equal(cfg.issuer, 'http://127.0.0.1');

    await assert.rejects(
      fetchOidcConfiguration(`http://127.0.0.1:${badServer.port}`),
      /Failed to load OIDC configuration \(503\)/,
    );
  } finally {
    await okServer.close();
    await badServer.close();
  }
});

test('exchangeCodeForToken sends OAuth payload and maps success/failure', async () => {
  const requests: Array<Record<string, unknown>> = [];
  const { port, close } = await listenServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/oauth/token') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
        if (requests.length === 1) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            access_token: 'token_1',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid',
            user: { id: 1 },
          }));
          return;
        }
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('invalid_grant');
      });
      return;
    }
    res.writeHead(404).end();
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const ok = await exchangeCodeForToken({
      baseUrl,
      code: 'auth_code',
      codeVerifier: 'verifier',
      redirectUri: 'http://127.0.0.1:8765/callback',
      clientId: 'usertold-cli',
    });
    assert.equal(ok.access_token, 'token_1');
    assert.equal(requests[0].grant_type, 'authorization_code');
    assert.equal(requests[0].code_verifier, 'verifier');

    await assert.rejects(
      exchangeCodeForToken({
        baseUrl,
        code: 'bad',
        codeVerifier: 'verifier',
        redirectUri: 'http://127.0.0.1:8765/callback',
        clientId: 'usertold-cli',
      }),
      /Token exchange failed \(400\): invalid_grant/,
    );
  } finally {
    await close();
  }
});

test('authorization code listener resolves on valid callback using its assigned port', async () => {
  const listener = startAuthorizationCodeListener(0, 'state_1');
  const port = await listener.ready;

  const res = await fetch(`http://127.0.0.1:${port}/callback?code=abc123&state=state_1`);
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /You're all set/);
  assert.match(page, /UserTold<span class="wordmark-accent">\.ai<\/span>/);
  assert.match(page, /M42 32V45H23/);
  assert.match(page, /Real users\./);
  assert.match(page, /Grounded Findings\./);
  assert.match(page, /Shipped change\./);
  assert.match(page, /Listen\./);
  assert.match(page, /Prove\./);
  assert.match(page, /Move\./);
  assert.match(page, /Real voices/);
  assert.match(page, /Linked evidence/);
  assert.match(page, /Ship · learn · repeat/);
  assert.match(page, /Back to your terminal/);
  assert.doesNotMatch(page, /One agent-ready loop/);
  assert.doesNotMatch(page, /Goals \+ intake/);
  assert.doesNotMatch(page, /Impact \+ recurrence/);
  assert.doesNotMatch(page, /Research that reaches delivery/);
  assert.doesNotMatch(page, /Design studies and intake/);
  assert.doesNotMatch(page, /usertold --help --json/);
  assert.doesNotMatch(page, /usertold auth whoami --json/);
  const body = await listener.result;
  assert.equal(body.code, 'abc123');
});

test('startAuthorizationCodeListener closes keep-alive callback sockets after auth', async () => {
  const listener = startAuthorizationCodeListener(0, 'state_1');
  const agent = new Agent({ keepAlive: true });

  try {
    const port = await listener.ready;
    await new Promise<void>((resolve, reject) => {
      const req = get(`http://127.0.0.1:${port}/callback?code=abc123&state=state_1`, { agent }, (res) => {
        assert.equal(res.statusCode, 200);
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
    });

    const body = await listener.result;
    assert.equal(body.code, 'abc123');

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(countAgentSockets(agent), 0);
  } finally {
    agent.destroy();
  }
});

test('authorization code listener rejects on OAuth errors and state mismatch', async () => {
  const errorListener = startAuthorizationCodeListener(0, 'state_1');
  const errorPort = await errorListener.ready;
  const oauthErrorAssert = assert.rejects(errorListener.result, /OAuth error: access_denied - denied/);
  const oauthErrorRes = await fetch(
    `http://127.0.0.1:${errorPort}/callback?error=access_denied&error_description=denied&state=state_1`,
  );
  assert.equal(oauthErrorRes.status, 400);
  await oauthErrorAssert;

  const mismatchListener = startAuthorizationCodeListener(0, 'state_expected');
  const mismatchPort = await mismatchListener.ready;
  const mismatchAssert = assert.rejects(mismatchListener.result, /State mismatch/);
  const mismatchRes = await fetch(`http://127.0.0.1:${mismatchPort}/callback?code=ok&state=wrong`);
  assert.equal(mismatchRes.status, 400);
  await mismatchAssert;
});

test('authorization code listener rejects on missing code and ignores non-callback paths', async () => {
  const noCodeListener = startAuthorizationCodeListener(0, 'state_1');
  const noCodePort = await noCodeListener.ready;
  const noCodeAssert = assert.rejects(noCodeListener.result, /Missing authorization code/);
  const noCodeRes = await fetch(`http://127.0.0.1:${noCodePort}/callback?state=state_1`);
  assert.equal(noCodeRes.status, 400);
  await noCodeAssert;

  const pathListener = startAuthorizationCodeListener(0, 'state_1');
  const pathPort = await pathListener.ready;
  const notFound = await fetch(`http://127.0.0.1:${pathPort}/not-callback`);
  assert.equal(notFound.status, 404);

  // Complete this pending server to avoid timeout leak.
  await fetch(`http://127.0.0.1:${pathPort}/callback?code=done&state=state_1`);
  const resolved = await pathListener.result;
  assert.equal(resolved.code, 'done');
});
