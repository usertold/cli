import type { CliEnvironment, ParsedArgs } from '../lib/types';
import { parseEnvironment } from '../lib/args';
import { consumeProjectRef } from '../lib/project-defaults';
import type { CliFlatCommand, CliSubcommand } from './help-manifest';

const OUTPUT_OPTIONS = new Set(['dry-run', 'format', 'json']);
const SENSITIVE_OPTIONS = new Set(['data', 'header', 'key', 'openai-key', 'token', 'value']);

type DryRunPlan = {
  dry_run: true;
  command: string;
  operation: 'read' | 'write' | 'delete';
  environment: CliEnvironment;
  arguments: Record<string, string>;
  options: Record<string, string | string[]>;
};

export async function printDryRunPlan(
  commandName: string,
  subcommandName: string | undefined,
  definition: CliFlatCommand | CliSubcommand,
  parsed: ParsedArgs,
): Promise<void> {
  const command = [commandName, subcommandName].filter(Boolean).join(' ');
  const plan: DryRunPlan = {
    dry_run: true,
    command,
    operation: definition.operation,
    environment: parseEnvironment(parsed),
    arguments: await resolveDryRunArguments(command, definition, parsed),
    options: Object.fromEntries(Object.entries(parsed.multiOptions).flatMap(([name, values]) => {
      if (OUTPUT_OPTIONS.has(name)) return [];
      const value = SENSITIVE_OPTIONS.has(name)
        ? '<redacted>'
        : values.length === 1 ? values[0] : values;
      return [[name, value]];
    })),
  };

  if (parsed.options.json === 'true' || parsed.options.format === 'json') {
    console.log(JSON.stringify(plan));
    return;
  }

  console.log('Dry run: no changes were made.');
  console.log(`Would run: usertold ${plan.command}`);
  console.log(`Environment: ${plan.environment}`);
  printEntries('Arguments', plan.arguments);
  printEntries('Options', plan.options);
}

async function resolveDryRunArguments(
  command: string,
  definition: CliFlatCommand | CliSubcommand,
  parsed: ParsedArgs,
): Promise<Record<string, string>> {
  const [projectPositional, ...resourcePositionals] = definition.positionals;
  if (projectPositional?.name === 'projectRef' && !projectPositional.required) {
    const resourceArgCount = command === 'interview upload-video' && (parsed.options.audio || parsed.options.video)
      ? 0
      : resourcePositionals.length;
    const resolved = await consumeProjectRef(parsed, parseEnvironment(parsed), {
      resourceArgCount,
      commandLabel: command,
    });
    return {
      projectRef: resolved.projectRef,
      ...Object.fromEntries(resourcePositionals.flatMap((positional, index) => {
        const value = resolved.args[index];
        return value === undefined ? [] : [[positional.name, value]];
      })),
    };
  }

  return Object.fromEntries(definition.positionals.flatMap((positional, index) => {
    const value = parsed.positionals[index];
    return value === undefined ? [] : [[positional.name, value]];
  }));
}

function printEntries(label: string, entries: Record<string, string | string[]>): void {
  const values = Object.entries(entries);
  if (values.length === 0) return;
  console.log(`${label}:`);
  for (const [name, value] of values) {
    console.log(`  ${name}: ${Array.isArray(value) ? value.join(', ') : value}`);
  }
}
