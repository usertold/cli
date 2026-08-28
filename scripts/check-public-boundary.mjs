import { access, readFile } from 'node:fs/promises';

const forbiddenFiles = [
  'src/cli/commands/admin.ts',
  'src/cli/commands/api.ts',
  'src/cli/commands/extract.ts',
];
for (const file of forbiddenFiles) {
  try {
    await access(new URL(`../${file}`, import.meta.url));
    throw new Error(`Private command source must not exist: ${file}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const registry = await readFile(new URL('../src/cli/commands/command-registry.ts', import.meta.url), 'utf8');
const entrypoint = await readFile(new URL('../src/cli/index.ts', import.meta.url), 'utf8');
const bundle = await readFile(new URL('../dist/usertold.js', import.meta.url), 'utf8');
const production = `${registry}\n${entrypoint}\n${bundle}`;
const forbidden = [
  /usertold admin\b/,
  /usertold api\b/,
  /usertold extract\b/,
  /\/api\/admin\//,
  /retry-media-merge/,
  /interview forensics/,
  /interview events/,
  /interview end/,
  /study reprocess/,
  /signal-extractor/,
  /backend\/services/,
];
for (const pattern of forbidden) {
  if (pattern.test(production)) throw new Error(`Public boundary violation: ${pattern}`);
}

console.log('Public command boundary verified');
