import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { InterviewArtifactManifest } from '../shared/interview-artifacts';

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--import', 'tsx', 'src/cli/index.ts', ...args], {
      cwd: process.cwd(),
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function sendJson(res: ServerResponse, value: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

function manifest(baseUrl: string): InterviewArtifactManifest {
  const expiresAt = '2099-01-01T00:00:00.000Z';
  const artifact = (
    kind: InterviewArtifactManifest['artifacts'][number]['kind'],
    mimeType: string,
    bytes: Buffer,
  ): InterviewArtifactManifest['artifacts'][number] => ({
    kind,
    availability: 'available',
    mimeType,
    sizeBytes: bytes.byteLength,
    downloadUrl: `${baseUrl}/downloads/${kind}`,
    expiresAt,
  });
  return {
    interviewRef: 'int_1',
    artifacts: [
      artifact('transcript_text', 'text/plain; charset=utf-8', Buffer.from('Exact participant words.')),
      artifact('transcript_vtt', 'text/vtt; charset=utf-8', Buffer.from('WEBVTT\n')),
      artifact('audio', 'audio/mp4', Buffer.from('audio!')),
      artifact('screen', 'video/mp4', Buffer.from('screen!')),
      artifact('events', 'application/x-ndjson', Buffer.from('{"type":"source"}\n')),
    ],
  };
}

test('artifact commands expose signed links and download exact bytes without forwarding authorization', async () => {
  const directAuthorizations: Array<string | undefined> = [];
  let currentManifest: InterviewArtifactManifest;
  const bodies: Record<string, Buffer> = {
    transcript_text: Buffer.from('Exact participant words.'),
    transcript_vtt: Buffer.from('WEBVTT\n'),
    audio: Buffer.from('audio!'),
    screen: Buffer.from('screen!'),
    events: Buffer.from('{"type":"source"}\n'),
  };
  const server = createServer((req, res) => {
    if (req.url === '/api/orgs/acme/projects/checkout/sessions/int_1/artifacts') {
      assert.equal(req.headers.authorization, 'Bearer test-token');
      sendJson(res, currentManifest);
      return;
    }
    if (req.url === '/api/orgs/acme/projects/checkout/sessions/int_1') {
      assert.equal(req.headers.authorization, 'Bearer test-token');
      sendJson(res, {
        session: { audio_media_key: 'audio-key', screen_media_key: 'screen-key' },
        audioChunks: [],
        screenManifest: null,
      });
      return;
    }
    const kind = req.url?.match(/^\/downloads\/(.+)$/)?.[1];
    if (kind && bodies[kind]) {
      directAuthorizations.push(req.headers.authorization);
      const extension = kind === 'audio' || kind === 'screen' ? 'mp4' : kind === 'events' ? 'jsonl' : 'txt';
      res.writeHead(200, {
        'content-type': currentManifest.artifacts.find(item => item.kind === kind)?.mimeType ?? 'application/octet-stream',
        'content-length': String(bodies[kind].byteLength),
        'content-disposition': `attachment; filename="int_1-${kind}.${extension}"`,
      });
      res.end(bodies[kind]);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  currentManifest = manifest(baseUrl);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'usertold-artifact-cli-'));
  const env = {
    ...process.env,
    USERTOLD_API_BASE: baseUrl,
    USERTOLD_API_KEY: 'test-token',
  };

  try {
    const listed = await runCli(['interview', 'artifacts', 'acme/checkout', 'int_1', '--json'], env);
    assert.equal(listed.code, 0, listed.stderr);
    assert.deepEqual(JSON.parse(listed.stdout), currentManifest);

    const media = await runCli(['interview', 'media', 'acme/checkout', 'int_1', '--json'], env);
    assert.equal(media.code, 0, media.stderr);
    assert.equal(JSON.parse(media.stdout).audio.downloadUrl, `${baseUrl}/downloads/audio`);
    assert.deepEqual({
      available: JSON.parse(media.stdout).audio.available,
      merged: JSON.parse(media.stdout).audio.merged,
      chunk_backed: JSON.parse(media.stdout).audio.chunk_backed,
      source: JSON.parse(media.stdout).audio.source,
      url: JSON.parse(media.stdout).audio.url,
    }, {
      available: true,
      merged: true,
      chunk_backed: false,
      source: 'merged',
      url: `${baseUrl}/downloads/audio`,
    });

    const urlOnly = await runCli(['interview', 'artifact', 'acme/checkout', 'int_1', 'events'], env);
    assert.equal(urlOnly.code, 0, urlOnly.stderr);
    assert.equal(urlOnly.stdout.trim(), `${baseUrl}/downloads/events`);

    const destination = path.join(directory, 'recording.mp4');
    const downloaded = await runCli([
      'interview', 'artifact', 'acme/checkout', 'int_1', 'audio', '--download', '--output', destination, '--json',
    ], env);
    assert.equal(downloaded.code, 0, downloaded.stderr);
    assert.equal((JSON.parse(downloaded.stdout) as { path: string }).path, destination);
    assert.deepEqual(await readFile(destination), bodies.audio);

    const eventsPath = path.join(directory, 'events.jsonl');
    const events = await runCli([
      'interview', 'artifact', 'acme/checkout', 'int_1', 'events', '--download', '--output', eventsPath,
    ], env);
    assert.equal(events.code, 0, events.stderr);
    assert.deepEqual(await readFile(eventsPath), bodies.events);

    const vttPath = path.join(directory, 'transcript.vtt');
    const vtt = await runCli([
      'interview', 'artifact', 'acme/checkout', 'int_1', 'transcript_vtt', '--download', '--output', vttPath,
    ], env);
    assert.equal(vtt.code, 0, vtt.stderr);
    assert.deepEqual(await readFile(vttPath), bodies.transcript_vtt);

    const transcript = await runCli(['interview', 'transcript', 'acme/checkout', 'int_1', '--raw'], env);
    assert.equal(transcript.code, 0, transcript.stderr);
    assert.equal(transcript.stdout, bodies.transcript_text.toString());

    const screen = currentManifest.artifacts.find(item => item.kind === 'screen');
    assert.ok(screen);
    screen.availability = 'interrupted';
    screen.downloadUrl = null;
    screen.expiresAt = null;
    const unavailable = await runCli(['interview', 'artifact', 'acme/checkout', 'int_1', 'screen'], env);
    assert.equal(unavailable.code, 1);
    assert.match(unavailable.stderr, /Artifact screen is interrupted/);
    assert.deepEqual(directAuthorizations, [undefined, undefined, undefined, undefined]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('artifact download refreshes its manifest once after an expired signed URL', async () => {
  let manifestRequests = 0;
  const content = Buffer.from('fresh!');
  let baseUrl = '';
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/api/orgs/acme/projects/checkout/sessions/int_1/artifacts') {
      manifestRequests += 1;
      const value = manifest(baseUrl);
      const audio = value.artifacts.find(item => item.kind === 'audio');
      assert.ok(audio);
      audio.downloadUrl = `${baseUrl}/downloads/${manifestRequests === 1 ? 'expired' : 'fresh'}`;
      audio.sizeBytes = content.byteLength;
      sendJson(res, value);
      return;
    }
    assert.equal(req.headers.authorization, undefined);
    if (req.url === '/downloads/expired') {
      res.writeHead(403).end('expired');
      return;
    }
    if (req.url === '/downloads/fresh') {
      res.writeHead(200, {
        'content-length': String(content.byteLength),
        'content-disposition': 'attachment; filename="int_1-audio.m4a"',
      });
      res.end(content);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'usertold-artifact-refresh-'));
  const destination = path.join(directory, 'audio.m4a');

  try {
    const result = await runCli([
      'interview', 'artifact', 'acme/checkout', 'int_1', 'audio', '--download', '--output', destination,
    ], {
      ...process.env,
      USERTOLD_API_BASE: baseUrl,
      USERTOLD_API_KEY: 'test-token',
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(manifestRequests, 2);
    assert.deepEqual(await readFile(destination), content);
    assert.deepEqual(await readdir(directory), ['audio.m4a']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
