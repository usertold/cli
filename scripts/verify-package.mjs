import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const temp = await mkdtemp(path.join(tmpdir(), 'usertold-package-'));
try {
  const output = execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp], {
    encoding: 'utf8',
  });
  const [{ filename }] = JSON.parse(output);
  const tarball = path.join(temp, filename);
  const entries = execFileSync('tar', ['-tf', tarball], { encoding: 'utf8' }).trim().split('\n');
  const required = [
    'package/package.json',
    'package/README.md',
    'package/CHANGELOG.md',
    'package/docs/COMMAND_SURFACE.md',
    'package/docs/RELEASE_NOTES_1X.md',
    'package/LICENSE',
    'package/NOTICE',
    'package/TRADEMARKS.md',
    'package/THIRD_PARTY_NOTICES.md',
    'package/dist/usertold.js',
  ];
  for (const entry of required) {
    if (!entries.includes(entry)) throw new Error(`Package is missing ${entry}`);
  }
  if (entries.some(entry => entry.startsWith('package/src/') || entry.includes('/scripts/'))) {
    throw new Error('Package includes development or private source files');
  }
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  if (manifest.name !== 'usertold' || manifest.license !== 'Apache-2.0') {
    throw new Error('Package identity or license is incorrect');
  }
  console.log(`Verified ${filename}: ${entries.length} files`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
