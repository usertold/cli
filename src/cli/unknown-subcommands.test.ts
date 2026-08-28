import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

type CliResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function runCli(args: string[], cwd: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['--import', 'tsx', 'src/cli/index.ts', ...args],
      { cwd },
    );

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

test('top-level unknown command prints root help and actionable error', async () => {
  const cwd = process.cwd();
  const result = await runCli(['definitely-not-a-command'], cwd);

  assert.equal(result.code, 1);
  assert.match(result.stdout, /Groups:/);
  assert.match(result.stderr, /Error: Unknown command: definitely-not-a-command/);
});

test('unknown commands in json mode include recovery metadata', async () => {
  const cwd = process.cwd();
  const result = await runCli(['evidence', 'definitely-not-a-subcommand', '--json'], cwd);

  assert.equal(result.code, 1);
  assert.equal(result.stdout.trim(), '');
  const payload = JSON.parse(result.stderr) as {
    error: { code: string; hint: string; validCommands: string[] };
  };
  assert.equal(payload.error.code, 'ERROR');
  assert.match(payload.error.hint, /usertold evidence --help --json/);
  assert.ok(payload.error.validCommands.includes('list'));
});

test('unknown root command in json mode keeps stdout machine-parseable', async () => {
  const cwd = process.cwd();
  const result = await runCli(['definitely-not-a-command', '--json'], cwd);

  assert.equal(result.code, 1);
  // No human root help may leak onto stdout ahead of the JSON error.
  assert.equal(result.stdout.trim(), '');
  assert.doesNotMatch(result.stdout, /Groups:/);
  const payload = JSON.parse(result.stderr) as { error: { message: string; validCommands: string[] } };
  assert.match(payload.error.message, /Unknown command: definitely-not-a-command/);
  assert.ok(payload.error.validCommands.includes('auth'));
});

test('unknown json help path returns an error instead of root manifest', async () => {
  const cwd = process.cwd();
  const result = await runCli(['setup', '--help', '--json'], cwd);

  assert.equal(result.code, 1);
  assert.equal(result.stdout.trim(), '');
  const payload = JSON.parse(result.stderr) as {
    error: { message: string; validCommands: string[] };
  };
  assert.match(payload.error.message, /Unknown command: setup/);
  assert.ok(!payload.error.validCommands.includes('setup'));
});
