import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildCommandSurface, commandOptionNames } from './commands/help-manifest';

const repoRoot = process.cwd();

const surface = buildCommandSurface();
const globalFlags = new Set(surface.globalOptions.flatMap(option => [option.name, ...(option.aliases ?? [])]));
const groupsWithSubcommands = Object.fromEntries(surface.commands
  .filter(command => command.kind === 'group')
  .map(command => [command.name, Object.keys(command.subcommands)]));
const topLevelCommands = new Set([...surface.commands.map(command => command.name), 'help']);

async function walkFiles(dir: string, filePaths: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, filePaths);
      continue;
    }
    if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.md')) {
      filePaths.push(fullPath);
    }
  }
  return filePaths;
}

function normalizeSnippet(snippet: string): string {
  return snippet
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateSnippet(filePath: string, snippet: string): string | null {
  const normalized = normalizeSnippet(snippet);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  if (tokens.length < 2 || tokens[0] !== 'usertold') return null;

  const command = tokens[1];
  if (command === '--help' || command === '-h' || command.startsWith('[')) return null;
  if (command.startsWith('<')) return null;
  if (!topLevelCommands.has(command)) {
    return `${filePath}: unknown top-level command "${command}" in snippet "${snippet}"`;
  }

  if (!(command in groupsWithSubcommands)) {
    if (command === 'init') {
      const initFlags = commandOptionNames('init');
      const snippetFlags = tokens
        .filter(t => t.startsWith('--'))
        .map(t => t.replace(/^--/, '').split('=')[0])
        .filter(f => !globalFlags.has(f));
      for (const flag of snippetFlags) {
        if (!initFlags.includes(flag)) {
          return `${filePath}: unknown flag "--${flag}" for "init" in snippet "${snippet}"`;
        }
      }
    }
    return null;
  }

  const subcommands = groupsWithSubcommands[command];
  if (subcommands.length === 0) return null;

  const subcommand = tokens[2];
  if (subcommand === '--help' || subcommand === '-h') {
    return null;
  }
  if (subcommand?.startsWith('[')) {
    return null;
  }
  if (subcommand?.startsWith('<')) {
    return null;
  }
  if (!subcommand || subcommand.startsWith('--')) {
    return `${filePath}: missing subcommand for "${command}" in snippet "${snippet}"`;
  }

  if (!subcommands.includes(subcommand)) {
    return `${filePath}: unknown subcommand "${command} ${subcommand}" in snippet "${snippet}"`;
  }

  const allowedFlags = commandOptionNames(command, subcommand);
  if (allowedFlags) {
    const snippetFlags = tokens
      .filter(t => t.startsWith('--'))
      .map(t => t.replace(/^--/, '').split('=')[0])
      .filter(f => !globalFlags.has(f));
    for (const flag of snippetFlags) {
      if (!allowedFlags.includes(flag)) {
        return `${filePath}: unknown flag "--${flag}" for "${command} ${subcommand}" in snippet "${snippet}"`;
      }
    }
  }

  return null;
}

test('public documentation snippets reference valid commands and flags', async () => {
  const targets = [
    path.join(repoRoot, 'README.md'),
    path.join(repoRoot, 'docs'),
  ];

  const files = [
    targets[0],
    ...(await walkFiles(targets[1])),
  ];
  const errors: string[] = [];
  const pattern = /^[ \t]*usertold[ \t]+[^\n]+/gm;

  for (const filePath of files) {
    if (filePath.includes(`${path.sep}docs${path.sep}internal${path.sep}`)) continue;
    const text = await readFile(filePath, 'utf8');
    const snippets = text.match(pattern) ?? [];
    for (const snippet of snippets) {
      const error = validateSnippet(filePath, snippet.trim());
      if (error) errors.push(error);
    }
  }

  assert.deepEqual(errors, [], errors.join('\n'));
});
