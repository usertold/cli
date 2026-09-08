import { chmod, mkdir, readFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const outfile = new URL('../dist/usertold.js', import.meta.url);

await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist', import.meta.url), { recursive: true });

const result = await build({
  entryPoints: [new URL('../src/cli/index.ts', import.meta.url).pathname],
  outfile: outfile.pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  define: { '__USERTOLD_PUBLIC_CLI_VERSION__': JSON.stringify(packageJson.version) },
  legalComments: 'none',
  metafile: true,
});

const zodInputs = Object.keys(result.metafile.inputs)
  .filter((input) => input.includes('node_modules/zod/'));
if (zodInputs.length > 0) {
  throw new Error(`Public CLI bundle must not include Zod: ${zodInputs.join(', ')}`);
}

await chmod(outfile, 0o755);
console.log(`Built usertold ${packageJson.version}`);
