import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const runCli = (args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> => {
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
};

test('help command displays command groups', async () => {
  const cwd = process.cwd();
  const result = await runCli(['help'], cwd);

  assert.equal(result.code, 0, `CLI exited with code ${result.code}; stderr: ${result.stderr}`);

  const expected = [
    'auth',
    'project',
    'interview',
    'evidence',
    'work',
    'intake',
    'study',
    'billing',
    'export',
    'knowledge',
    'init',
    'completions',
  ];

  for (const token of expected) {
    assert.ok(result.stdout.includes(token), `Root help should include "${token}"`);
  }
});

test('json help exposes the registered command hierarchy', async () => {
  const cwd = process.cwd();

  const root = await runCli(['--help', '--json'], cwd);
  assert.equal(root.code, 0, `CLI exited with code ${root.code}; stderr: ${root.stderr}`);
  const rootPayload = JSON.parse(root.stdout) as {
    usage: string;
    commands: Array<{ name: string; kind: string; subcommands?: Record<string, unknown> }>;
  };
  assert.equal(rootPayload.usage, 'usertold <group> <subcommand> [options]');
  assert.ok(rootPayload.commands.some(command => command.name === 'evidence' && command.kind === 'group'));
  assert.ok(!rootPayload.commands.some(command => command.name === 'setup'));
  assert.ok(!rootPayload.commands.some(command => command.name === 'introspect'));

  const nested = await runCli(['evidence', 'list', '--help', '--json'], cwd);
  assert.equal(nested.code, 0, `CLI exited with code ${nested.code}; stderr: ${nested.stderr}`);
  const nestedPayload = JSON.parse(nested.stdout) as { description: string; usage: string };
  assert.match(nestedPayload.description, /List evidence/);
  assert.match(nestedPayload.usage, /usertold evidence list/);
});

test('positional help alias honors json mode at the subcommand slot', async () => {
  const cwd = process.cwd();
  const result = await runCli(['evidence', 'help', '--json'], cwd);

  assert.equal(result.code, 0, `CLI exited with code ${result.code}; stderr: ${result.stderr}`);
  const payload = JSON.parse(result.stdout) as { name: string; kind: string };
  assert.equal(payload.name, 'evidence');
  assert.equal(payload.kind, 'group');
});

test('removed internal commands are rejected without leaking help', async () => {
  const cwd = process.cwd();
  for (const command of ['admin', 'api', 'extract', 'config']) {
    const result = await runCli([command, '--help', '--json'], cwd);
    assert.notEqual(result.code, 0, `${command} should not be public`);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Unknown command/);
  }
});

test('subcommand help displays focused human-readable command details', async () => {
  const cwd = process.cwd();
  const result = await runCli(['evidence', 'list', '--help'], cwd);

  assert.equal(result.code, 0, `CLI exited with code ${result.code}; stderr: ${result.stderr}`);
  assert.match(result.stdout, /Usage:\n  usertold evidence list \[<projectRef>\] \[options\]/);
  assert.match(result.stdout, /Arguments:/);
  assert.match(result.stdout, /projectRef/);
  assert.match(result.stdout, /--target-surface <product_under_test\|usertold_widget_interview/);
  assert.doesNotMatch(result.stdout, /bulk-delete \[<projectRef>\]/);

  const knowledgeResult = await runCli(['knowledge', 'apply', '--help'], cwd);
  assert.equal(knowledgeResult.code, 0, `CLI exited with code ${knowledgeResult.code}; stderr: ${knowledgeResult.stderr}`);
  assert.match(knowledgeResult.stdout, /Usage:\n  usertold knowledge apply/);
  assert.match(knowledgeResult.stdout, /--data/);
});
