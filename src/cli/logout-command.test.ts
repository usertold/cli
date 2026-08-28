import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type CliRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<CliRunResult> {
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

async function writeConfig(tmpDir: string, configs: Record<string, unknown>): Promise<void> {
  const configDir = path.join(tmpDir, 'usertold-cli');
  const configPath = path.join(configDir, 'config.json');
  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({ configs }), 'utf8');
}

test('auth logout --env removes only requested environment credentials', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-logout-env-'));
  const env = { ...process.env, XDG_CONFIG_HOME: tmpDir };

  try {
    await writeConfig(tmpDir, {
      stage: { environment: 'stage', token: { accessToken: 's', expiresAt: Date.now() + 60_000 } },
      production: { environment: 'production', token: { accessToken: 'p', expiresAt: Date.now() + 60_000 } },
    });

    const res = await runCli(['auth', 'logout', '--env', 'stage'], env);
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /Removed stored credentials for environment "stage"/);

    const configPath = path.join(tmpDir, 'usertold-cli', 'config.json');
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { configs: Record<string, unknown> };
    assert.equal(parsed.configs.stage, undefined);
    assert.ok(parsed.configs.production);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('auth logout without --env removes all credentials and handles missing files', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'usertold-cli-logout-all-'));
  const env = { ...process.env, XDG_CONFIG_HOME: tmpDir };

  try {
    await writeConfig(tmpDir, {
      stage: { environment: 'stage', token: { accessToken: 's', expiresAt: Date.now() + 60_000 } },
    });

    const all = await runCli(['auth', 'logout'], env);
    assert.equal(all.code, 0, all.stderr);
    assert.match(all.stdout, /Removed all stored credentials/);

    const second = await runCli(['auth', 'logout'], env);
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /No stored credentials were found/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
