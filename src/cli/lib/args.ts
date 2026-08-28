import { readFile } from 'node:fs/promises';
import type { CliEnvironment, ParsedArgs } from './types';
import { DEFAULT_ENVIRONMENT } from './config';
import { CliError, EXIT_ARGS, fail, failArgs } from './errors';

const BOOLEAN_VALUE_OPTIONS = new Set(['dry-run']);

export function parseArgs(argv: string[]): ParsedArgs {
  const options: Record<string, string> = {};
  const multiOptions: Record<string, string[]> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('-') || token === '-') {
      positionals.push(token);
      continue;
    }

    if (token.startsWith('--')) {
      const eqIndex = token.indexOf('=');
      if (eqIndex !== -1) {
        const key = token.slice(2, eqIndex);
        const value = token.slice(eqIndex + 1);
        if (BOOLEAN_VALUE_OPTIONS.has(key) && value !== 'true' && value !== 'false') {
          failArgs(`Invalid boolean "${value}" for --${key}. Expected true or false.`);
        }
        setOption(options, multiOptions, key, value);
        continue;
      }

      const key = token.slice(2);
      const next = argv[i + 1];
      if (BOOLEAN_VALUE_OPTIONS.has(key)) {
        if (next === 'true' || next === 'false') {
          setOption(options, multiOptions, key, next);
          i += 1;
        } else {
          setOption(options, multiOptions, key, 'true');
        }
        continue;
      }
      if (next && !next.startsWith('-')) {
        setOption(options, multiOptions, key, next);
        i += 1;
      } else {
        setOption(options, multiOptions, key, 'true');
      }
      continue;
    }

    // short option, e.g. -h
    const shortKey = token.slice(1);
    const next = argv[i + 1];
    if (next && !next.startsWith('-')) {
      setOption(options, multiOptions, shortKey, next);
      i += 1;
    } else {
      setOption(options, multiOptions, shortKey, 'true');
    }
  }

  return {
    raw: argv,
    options,
    multiOptions,
    positionals,
  };
}

function setOption(options: Record<string, string>, multiOptions: Record<string, string[]>, key: string, value: string) {
  options[key] = value;
  if (!multiOptions[key]) {
    multiOptions[key] = [];
  }
  multiOptions[key].push(value);
}

export function hasHelpFlag(parsed: ParsedArgs): boolean {
  return parsed.options.help === 'true' || parsed.options.h === 'true';
}

export function getBooleanOption(parsed: ParsedArgs, name: string): boolean {
  return parsed.options[name] === 'true';
}

export function getOptionValues(parsed: ParsedArgs, name: string): string[] {
  return parsed.multiOptions[name] ?? [];
}

export function requirePositional(parsed: ParsedArgs, index: number, label: string): string {
  const value = parsed.positionals[index];
  if (!value) {
    failArgs(`Missing required argument: ${label}`);
  }
  return value;
}

export function requireOption(parsed: ParsedArgs, name: string): string {
  const value = parsed.options[name];
  if (!value || value === 'true') {
    failArgs(`Missing required option: --${name}`);
  }
  return value;
}

export function assertNoExtraPositionals(parsed: ParsedArgs, expectedCount: number): void {
  if (parsed.positionals.length > expectedCount) {
    const extras = parsed.positionals.slice(expectedCount).join(' ');
    fail(`Unexpected extra arguments: ${extras}`);
  }
}

export function parseEnvironment(parsed: ParsedArgs): CliEnvironment {
  if (getBooleanOption(parsed, 'local')) {
    return 'local';
  }

  return normalizeEnvironment(parsed.options.env ?? DEFAULT_ENVIRONMENT);
}

export function parseOptionalEnvironment(parsed: ParsedArgs): CliEnvironment | null {
  if (getBooleanOption(parsed, 'local')) {
    return 'local';
  }

  if (!parsed.options.env) {
    return null;
  }

  return normalizeEnvironment(parsed.options.env);
}

function normalizeEnvironment(value: string): CliEnvironment {
  const envRaw = value.toLowerCase();
  if (envRaw === 'staging') {
    return 'stage';
  }

  if (envRaw !== 'stage' && envRaw !== 'production' && envRaw !== 'local') {
    fail(`Invalid environment "${envRaw}". Valid options: stage, production, local`);
  }

  return envRaw;
}

export async function parseJsonOrFile(value: string, fieldLabel: string): Promise<unknown> {
  const maybePath = value.startsWith('@') ? value.slice(1) : value;

  if (value.startsWith('@') || (!looksLikeJson(value) && !looksLikeInlinePrimitive(value))) {
    try {
      const raw = await readFile(maybePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      fail(`Invalid ${fieldLabel}. Expected JSON string or path to a JSON file. ${(error as Error).message}`);
    }
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    fail(`Invalid ${fieldLabel} JSON: ${(error as Error).message}`);
  }
}

export function parseHeaderPairs(values: string[]): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const value of values) {
    const idx = value.indexOf(':');
    if (idx === -1) {
      fail(`Invalid header "${value}". Expected format: key:value`);
    }

    const key = value.slice(0, idx).trim();
    const headerValue = value.slice(idx + 1).trim();

    if (!key || !headerValue) {
      fail(`Invalid header "${value}". Expected format: key:value`);
    }

    headers[key] = headerValue;
  }

  return headers;
}

export class UnknownFlagsError extends CliError {
  constructor(flags: string[]) {
    super(`Unknown flag(s): ${flags.map(f => `--${f}`).join(', ')}`, EXIT_ARGS);
    this.name = 'UnknownFlagsError';
  }
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"');
}

function looksLikeInlinePrimitive(value: string): boolean {
  return value === 'true' || value === 'false' || value === 'null' || /^-?\d+(\.\d+)?$/.test(value);
}
