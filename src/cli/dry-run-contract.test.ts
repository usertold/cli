import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCommandSurface, type CliFlatCommand, type CliSubcommand } from './commands/help-manifest';

type DryRunCase = {
  name: string;
  argv: string[];
  definition: CliFlatCommand | CliSubcommand;
};

const UPDATE_OPTION_SAMPLES: Record<string, string[]> = {
  'project update': ['--name', 'Planned name'],
  'interview update': ['--summary', 'Planned summary'],
  'findings update': ['--title', 'Planned title'],
  'intake update': ['--title', 'Planned title'],
  'study update': ['--title', 'Planned title'],
};

function registeredDryRunCases(): DryRunCase[] {
  const testCases: DryRunCase[] = [];
  for (const command of buildCommandSurface().commands) {
    if (command.kind === 'command') {
      assert.equal(command.dryRunSupported, true, command.name);
      testCases.push({ name: command.name, argv: [command.name], definition: command });
      continue;
    }
    for (const [subcommandName, definition] of Object.entries(command.subcommands)) {
      const name: string = `${command.name} ${subcommandName}`;
      assert.equal(definition.dryRunSupported, true, name);
      testCases.push({ name, argv: [command.name, subcommandName], definition });
    }
  }
  return testCases;
}

function invocation(testCase: DryRunCase): string[] {
  const positionals = testCase.definition.positionals.map((positional) => {
    if (positional.name === 'projectRef') return 'acme/checkout';
    if (positional.name === 'METHOD') return 'PATCH';
    if (positional.name === 'PATH') return '/api/dry-run-probe';
    if (positional.name === 'action') return 'grant';
    return `test-${positional.name}`;
  });
  const requiredOptions = testCase.definition.options.flatMap((option) => {
    if (!option.required) return [];
    if (option.type === 'boolean') return [`--${option.name}`];
    if (option.type === 'integer' || option.type === 'number') return [`--${option.name}`, '1'];
    if (option.type === 'json') return [`--${option.name}`, '{}'];
    return [`--${option.name}`, option.values?.[0] ?? `test-${option.name}`];
  });
  return [
    ...testCase.argv,
    ...positionals,
    ...requiredOptions,
    ...(UPDATE_OPTION_SAMPLES[testCase.name] ?? []),
    '--dry-run',
    '--json',
  ];
}

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

test('every registered dry-run command exits before remote or local mutation', async () => {
  const testCases = registeredDryRunCases();
  assert.equal(testCases.length, 117);

  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'dry-run reached transport' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const configHome = await mkdtemp(path.join(os.tmpdir(), 'usertold-dry-run-'));
  const env = {
    ...process.env,
    USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`,
    USERTOLD_API_KEY: 'test-token',
    XDG_CONFIG_HOME: configHome,
  };

  try {
    for (const testCase of testCases) {
      const result = await runCli(invocation(testCase), env);
      assert.equal(result.code, 0, `${testCase.name}: ${result.stderr}`);
      const plan = JSON.parse(result.stdout) as { dry_run?: boolean; command?: string };
      assert.equal(plan.dry_run, true, testCase.name);
      assert.equal(plan.command, testCase.name, testCase.name);
    }

    assert.deepEqual(requests, []);
    assert.deepEqual(await readdir(configHome), []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(configHome, { recursive: true, force: true });
  }
});

test('dry-run resolves default-project resource arguments like normal execution', async () => {
  const configHome = await mkdtemp(path.join(os.tmpdir(), 'usertold-dry-run-default-'));
  const configDirectory = path.join(configHome, 'usertold-cli');
  await mkdir(configDirectory, { recursive: true });
  await writeFile(path.join(configDirectory, 'config.json'), JSON.stringify({
    configs: {},
    preferences: { production: { currentProjectRef: 'acme/checkout' } },
  }), 'utf8');

  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'dry-run reached transport' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const env = {
    ...process.env,
    XDG_CONFIG_HOME: configHome,
    USERTOLD_API_BASE: `http://127.0.0.1:${address.port}`,
    USERTOLD_API_KEY: 'test-token',
  };

  try {
    const result = await runCli(['findings', 'delete', 'tsk_1', '--dry-run', '--json'], env);
    assert.equal(result.code, 0, result.stderr);
    const plan = JSON.parse(result.stdout) as { arguments: Record<string, string> };
    assert.deepEqual(plan.arguments, { projectRef: 'acme/checkout', findingId: 'tsk_1' });

    const separateMedia = await runCli([
      'interview', 'upload-video', '--audio', 'audio.wav', '--dry-run', '--json',
    ], env);
    assert.equal(separateMedia.code, 0, separateMedia.stderr);
    const mediaPlan = JSON.parse(separateMedia.stdout) as { arguments: Record<string, string> };
    assert.deepEqual(mediaPlan.arguments, { projectRef: 'acme/checkout' });

    const beforePositionals = await runCli([
      'study', 'update', '--dry-run', 'acme/checkout', 'std_1', '--title', 'X', '--json',
    ], env);
    assert.equal(beforePositionals.code, 0, beforePositionals.stderr);
    const studyPlan = JSON.parse(beforePositionals.stdout) as { arguments: Record<string, string> };
    assert.deepEqual(studyPlan.arguments, { projectRef: 'acme/checkout', studyRef: 'std_1' });
    assert.deepEqual(requests, []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(configHome, { recursive: true, force: true });
  }
});

test('dry-run rejects invalid registered option values before producing a plan', async () => {
  const env = {
    ...process.env,
    USERTOLD_API_BASE: 'http://127.0.0.1:1',
    USERTOLD_API_KEY: 'test-token',
  };
  const result = await runCli([
    'findings', 'push', 'acme/checkout', 'tsk_1', '--provider', 'typo', '--dry-run', '--json',
  ], env);
  assert.equal(result.code, 2);
  assert.equal(result.stdout, '');
  const error = JSON.parse(result.stderr) as { error: { message: string } };
  assert.match(error.error.message, /Invalid value "typo" for --provider/);

  const emptyUpdate = await runCli([
    'study', 'update', 'acme/checkout', 'study-1', '--dry-run', '--json',
  ], env);
  assert.equal(emptyUpdate.code, 2);
  assert.equal(emptyUpdate.stdout, '');
  const updateError = JSON.parse(emptyUpdate.stderr) as { error: { message: string } };
  assert.match(updateError.error.message, /No update fields provided/);
});

test('dry-run validates and identifies the selected environment', async () => {
  const env = {
    ...process.env,
    USERTOLD_API_BASE: 'http://127.0.0.1:1',
    USERTOLD_API_KEY: 'test-token',
  };
  const stage = await runCli(['auth', 'logout', '--env', 'staging', '--dry-run', '--json'], env);
  assert.equal(stage.code, 0, stage.stderr);
  const stagePlan = JSON.parse(stage.stdout) as {
    environment: string;
    options: Record<string, string>;
  };
  assert.equal(stagePlan.environment, 'stage');
  assert.equal(stagePlan.options.env, 'staging');

  const upperCase = await runCli(['auth', 'logout', '--env', 'STAGE', '--dry-run', '--json'], env);
  assert.equal(upperCase.code, 0, upperCase.stderr);
  const upperCasePlan = JSON.parse(upperCase.stdout) as { environment: string };
  assert.equal(upperCasePlan.environment, 'stage');

  const local = await runCli(['auth', 'logout', '--env', 'typo', '--local', '--dry-run', '--json'], env);
  assert.equal(local.code, 0, local.stderr);
  const localPlan = JSON.parse(local.stdout) as {
    environment: string;
    options: Record<string, string>;
  };
  assert.equal(localPlan.environment, 'local');
  assert.deepEqual(localPlan.options, { env: 'typo', local: 'true' });

  const invalid = await runCli(['auth', 'logout', '--env', 'typo', '--dry-run', '--json'], env);
  assert.equal(invalid.code, 1);
  assert.equal(invalid.stdout, '');
  const invalidError = JSON.parse(invalid.stderr) as { error: { message: string } };
  assert.match(invalidError.error.message, /Invalid environment "typo"/);
});
