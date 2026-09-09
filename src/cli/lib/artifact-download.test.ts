import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ArtifactDownloadHttpError,
  defaultArtifactFilename,
  downloadArtifactResponse,
  fetchArtifactResponse,
  parseInterviewArtifactManifest,
  requireAvailableArtifact,
} from './artifact-download';
import type { InterviewArtifact, InterviewArtifactManifest } from '../../shared/interview-artifacts';

const availableAudio: InterviewArtifact & { downloadUrl: string } = {
  kind: 'audio',
  availability: 'available',
  mimeType: 'audio/mp4',
  sizeBytes: 6,
  downloadUrl: 'https://downloads.example.test/audio',
  expiresAt: '2099-01-01T00:00:00.000Z',
};

test('artifact download writes exact bytes atomically using the server filename', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'usertold-artifact-'));
  const originalDirectory = process.cwd();
  try {
    process.chdir(directory);
    const response = new Response('abcdef', {
      headers: { 'content-disposition': 'attachment; filename="int_1-audio.m4a"' },
    });
    const result = await downloadArtifactResponse(availableAudio, response);
    assert.equal(result.sizeBytes, 6);
    assert.equal(await readFile(result.path, 'utf8'), 'abcdef');
    assert.deepEqual(await readdir(directory), ['int_1-audio.m4a']);
  } finally {
    process.chdir(originalDirectory);
    await rm(directory, { recursive: true, force: true });
  }
});

test('artifact download removes partial output when the stream fails', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'usertold-artifact-'));
  const destination = path.join(directory, 'recording.webm');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('partial'));
      controller.error(new Error('connection lost'));
    },
  });
  try {
    await assert.rejects(
      downloadArtifactResponse({ ...availableAudio, mimeType: 'audio/webm', sizeBytes: null }, new Response(body), destination),
      /connection lost/,
    );
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('artifact download rejects a truncated body and preserves an existing destination', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'usertold-artifact-'));
  const truncatedPath = path.join(directory, 'truncated.m4a');
  const existingPath = path.join(directory, 'existing.m4a');
  await writeFile(existingPath, 'keep');
  try {
    await assert.rejects(
      downloadArtifactResponse(availableAudio, new Response('short'), truncatedPath),
      /expected 6 bytes, received 5/,
    );
    await assert.rejects(
      downloadArtifactResponse(availableAudio, new Response('abcdef'), existingPath),
      /Refusing to overwrite existing file/,
    );
    assert.equal(await readFile(existingPath, 'utf8'), 'keep');
    assert.deepEqual(await readdir(directory), ['existing.m4a']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('signed artifact requests do not add authorization and expose HTTP status', async () => {
  const originalFetch = globalThis.fetch;
  let authorization: string | null = 'not-called';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('authorization');
    return new Response('expired', { status: 403 });
  };
  try {
    await assert.rejects(fetchArtifactResponse(availableAudio), (error: unknown) => {
      return error instanceof ArtifactDownloadHttpError && error.status === 403;
    });
    assert.equal(authorization, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('artifact selection reports explicit availability and MIME-derived extensions', () => {
  const manifest: InterviewArtifactManifest = {
    interviewRef: 'int_1',
    artifacts: [{ ...availableAudio, availability: 'processing', downloadUrl: null }],
  };
  assert.throws(() => requireAvailableArtifact(manifest, 'audio'), /Artifact audio is processing/);
  assert.equal(defaultArtifactFilename('audio', 'audio/mpeg'), 'interview-audio.mp3');
  assert.equal(defaultArtifactFilename('screen', 'video/mp4'), 'interview-screen.mp4');
  assert.equal(defaultArtifactFilename('events', 'application/x-ndjson'), 'interview-events.jsonl');
});

test('manifest validation rejects unsafe links, duplicate kinds, and incomplete available entries', () => {
  const complete: InterviewArtifactManifest = {
    interviewRef: 'int_1',
    artifacts: [
      { ...availableAudio, kind: 'transcript_text', mimeType: 'text/plain' },
      { ...availableAudio, kind: 'transcript_vtt', mimeType: 'text/vtt' },
      availableAudio,
      { ...availableAudio, kind: 'screen', mimeType: 'video/mp4' },
      { ...availableAudio, kind: 'events', mimeType: 'application/x-ndjson' },
    ],
  };
  assert.deepEqual(parseInterviewArtifactManifest(complete), complete);
  assert.throws(
    () => parseInterviewArtifactManifest({
      ...complete,
      artifacts: complete.artifacts.map((item, index) => index === 0 ? { ...item, downloadUrl: 'file:///etc/passwd' } : item),
    }),
    /invalid/,
  );
  assert.throws(
    () => parseInterviewArtifactManifest({ ...complete, artifacts: complete.artifacts.map(item => ({ ...item, kind: 'audio' })) }),
    /duplicate audio/,
  );
  assert.throws(
    () => parseInterviewArtifactManifest({
      ...complete,
      artifacts: complete.artifacts.map((item, index) => index === 0 ? { ...item, downloadUrl: null } : item),
    }),
    /missing its download link or expiry/,
  );
});
