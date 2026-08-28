import { chmod, mkdir, readFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const outfile = new URL('../dist/usertold.js', import.meta.url);

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist', import.meta.url), { recursive: true });

await build({
  entryPoints: [new URL('../src/cli/index.ts', import.meta.url).pathname],
  outfile: outfile.pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  define: { '__USERTOLD_PUBLIC_CLI_VERSION__': JSON.stringify(packageJson.version) },
  legalComments: 'none',
});

await chmod(outfile, 0o755);
console.log(`Built usertold ${packageJson.version}`);
