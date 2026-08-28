import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  parseArgs,
  hasHelpFlag,
  getBooleanOption,
  getOptionValues,
  requirePositional,
  requireOption,
  assertNoExtraPositionals,
  parseEnvironment,
  parseOptionalEnvironment,
  parseJsonOrFile,
  parseHeaderPairs,
} from './args';
import { CliError, EXIT_ARGS, EXIT_ERROR } from './errors';

test('parseArgs parses long/short flags, equals syntax, and positionals', () => {
  const parsed = parseArgs(['project', 'list', '--env=stage', '--header', 'a:1', '--header', 'b:2', '-h', '--json']);

  assert.deepEqual(parsed.positionals, ['project', 'list']);
  assert.equal(parsed.options.env, 'stage');
  assert.equal(parsed.options.h, 'true');
  assert.equal(parsed.options.json, 'true');
  assert.deepEqual(getOptionValues(parsed, 'header'), ['a:1', 'b:2']);
});

test('hasHelpFlag and getBooleanOption return expected values', () => {
  const parsed = parseArgs(['--help', '--raw']);
  assert.equal(hasHelpFlag(parsed), true);
  assert.equal(getBooleanOption(parsed, 'raw'), true);
  assert.equal(getBooleanOption(parsed, 'json'), false);
});

test('parseArgs keeps positionals after dry-run and supports explicit booleans', () => {
  const bare = parseArgs(['--dry-run', 'acme/checkout', 'std_1', '--title', 'X']);
  assert.equal(bare.options['dry-run'], 'true');
  assert.deepEqual(bare.positionals, ['acme/checkout', 'std_1']);

  const spacedFalse = parseArgs(['--dry-run', 'false', 'acme/checkout']);
  assert.equal(spacedFalse.options['dry-run'], 'false');
  assert.deepEqual(spacedFalse.positionals, ['acme/checkout']);

  assert.equal(parseArgs(['--dry-run=true']).options['dry-run'], 'true');
  assert.equal(parseArgs(['--dry-run=false']).options['dry-run'], 'false');
  assert.throws(() => parseArgs(['--dry-run=maybe']), /Invalid boolean "maybe" for --dry-run/);
});

test('requirePositional throws args error when missing', () => {
  const parsed = parseArgs(['session']);
  assert.throws(
    () => requirePositional(parsed, 1, 'sessionId'),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ARGS
      && error.message.includes('Missing required argument: sessionId'),
  );
});

test('requireOption returns value and rejects missing or flag-only option', () => {
  const withValue = parseArgs(['--project', 'prj_123']);
  assert.equal(requireOption(withValue, 'project'), 'prj_123');

  const missing = parseArgs(['--json']);
  assert.throws(
    () => requireOption(missing, 'project'),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ARGS
      && error.message.includes('Missing required option: --project'),
  );
});

test('assertNoExtraPositionals fails when extra args are present', () => {
  const parsed = parseArgs(['task', 'get', 'project_1', 'extra']);
  assert.throws(
    () => assertNoExtraPositionals(parsed, 3),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ERROR
      && error.message.includes('Unexpected extra arguments: extra'),
  );
});

test('parseEnvironment handles local flag, staging alias, and invalid env', () => {
  assert.equal(parseEnvironment(parseArgs(['--local'])), 'local');
  assert.equal(parseEnvironment(parseArgs(['--env', 'staging'])), 'stage');
  assert.equal(parseEnvironment(parseArgs([])), 'production');

  assert.throws(
    () => parseEnvironment(parseArgs(['--env', 'qa'])),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ERROR
      && error.message.includes('Invalid environment "qa"'),
  );
});

test('parseOptionalEnvironment returns null when env is not provided', () => {
  assert.equal(parseOptionalEnvironment(parseArgs([])), null);
  assert.equal(parseOptionalEnvironment(parseArgs(['--env', 'production'])), 'production');
  assert.equal(parseOptionalEnvironment(parseArgs(['--local', '--env', 'production'])), 'local');
});

test('parseJsonOrFile supports inline JSON, primitives, @file, and inferred file path', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'args-test-'));
  try {
    const jsonPath = path.join(tempDir, 'payload.json');
    await writeFile(jsonPath, JSON.stringify({ ok: true, n: 7 }), 'utf8');

    assert.deepEqual(await parseJsonOrFile('{"a":1}', 'data'), { a: 1 });
    assert.equal(await parseJsonOrFile('7', 'data'), 7);
    assert.equal(await parseJsonOrFile('true', 'data'), true);
    assert.deepEqual(await parseJsonOrFile(`@${jsonPath}`, 'data'), { ok: true, n: 7 });
    assert.deepEqual(await parseJsonOrFile(jsonPath, 'data'), { ok: true, n: 7 });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseJsonOrFile throws clear errors for invalid JSON and unreadable files', async () => {
  await assert.rejects(
    async () => parseJsonOrFile('{bad}', 'payload'),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ERROR
      && error.message.includes('Invalid payload JSON'),
  );

  await assert.rejects(
    async () => parseJsonOrFile('@/definitely/missing.json', 'payload'),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ERROR
      && error.message.includes('Invalid payload. Expected JSON string or path to a JSON file.'),
  );
});

test('parseHeaderPairs parses valid pairs and rejects malformed headers', () => {
  assert.deepEqual(
    parseHeaderPairs(['Authorization:Bearer token', 'X-Env: stage']),
    { Authorization: 'Bearer token', 'X-Env': 'stage' },
  );

  assert.throws(
    () => parseHeaderPairs(['MissingColon']),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ERROR
      && error.message.includes('Expected format: key:value'),
  );

  assert.throws(
    () => parseHeaderPairs(['X-Test:']),
    (error: unknown) =>
      error instanceof CliError
      && error.exitCode === EXIT_ERROR
      && error.message.includes('Expected format: key:value'),
  );
});
