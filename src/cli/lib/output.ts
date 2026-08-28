import type { ParsedArgs } from './types';
import { presentExternalProjectStudyRefs } from '../../shared/external-reference-output';

const SENSITIVE_OUTPUT_KEYS = new Set([
  'secret_key',
  'wrapped_dek',
  'settings_json',
]);

/**
 * Returns true when output should be JSON:
 * - --json flag
 * - --format json flag
 * - stdout is not a TTY (piped)
 */
export function isJsonOutput(parsed: ParsedArgs): boolean {
  if (parsed.options.json === 'true') return true;
  if (parsed.options.format === 'json') return true;
  if (!process.stdout.isTTY) return true;
  return false;
}

// Some API families still respond with internal nouns (sessions/signals/tasks);
// the CLI surface speaks the loop vocabulary, so re-key the top-level
// collection/entity keys before they reach the user. Nested fields stay on the
// API contract.
export const VOCAB_OUTPUT_KEYS: Record<string, string> = {
  sessions: 'interviews',
  session: 'interview',
  signals: 'evidence',
  signal: 'evidence',
  tasks: 'work',
  task: 'work',
  // Composed planning collections (project overview, etc.).
  recent_sessions: 'recent_interviews',
  recent_signals: 'recent_evidence',
  top_tasks: 'top_work',
  top_signals: 'top_evidence',
  signal_counts: 'evidence_counts',
  task_counts: 'work_counts',
  session_counts: 'interview_counts',
};

export function remapVocabTopLevelKeys(data: unknown): unknown {
  if (!isRecord(data)) return data;
  const entries = Object.entries(data).map(([key, value]) => [VOCAB_OUTPUT_KEYS[key] ?? key, value] as const);
  return Object.fromEntries(entries);
}

export function printOutput(data: unknown, parsed: ParsedArgs, options: { remapVocab?: boolean } = {}): void {
  const redacted = redactSensitiveOutput(data);
  // `usertold api` is a raw HTTP passthrough — it must echo the literal API
  // response, so it opts out of both customer-facing boundary transforms.
  const safeData = options.remapVocab === false
    ? redacted
    : remapVocabTopLevelKeys(presentExternalProjectStudyRefs(redacted));

  if (isJsonOutput(parsed)) {
    console.log(JSON.stringify(safeData, null, 2));
    return;
  }

  if (Array.isArray(safeData)) {
    printTable(safeData);
    return;
  }

  if (isRecord(safeData)) {
    const arrayEntry = findFirstArrayEntry(safeData);
    if (arrayEntry) {
      const [key, value] = arrayEntry;
      console.log(`${key}:`);
      printTable(value);

      const meta = Object.fromEntries(
        Object.entries(safeData).filter(([entryKey]) => entryKey !== key),
      );
      if (Object.keys(meta).length > 0) {
        console.log('');
        printObject(meta);
      }
      return;
    }

    printObject(safeData);
    return;
  }

  if (safeData === null || safeData === undefined) {
    console.log('(empty)');
    return;
  }

  console.log(String(safeData));
}

export function printTable(rows: unknown[]): void {
  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }

  const normalized = rows.map((row) => (isRecord(row) ? row : { value: row }));
  const columns = Array.from(new Set(normalized.flatMap((row) => Object.keys(row))));

  const widths = columns.map((column) => {
    const values = normalized.map((row) => formatCell(row[column]));
    return Math.max(column.length, ...values.map((v) => v.length));
  });

  const divider = widths.map((w) => '-'.repeat(w)).join('-+-');
  const header = columns.map((column, idx) => column.padEnd(widths[idx])).join(' | ');

  console.log(header);
  console.log(divider);

  for (const row of normalized) {
    const line = columns
      .map((column, idx) => formatCell(row[column]).padEnd(widths[idx]))
      .join(' | ');
    console.log(line);
  }
}

export function printObject(data: Record<string, unknown>): void {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    console.log('{}');
    return;
  }

  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      console.log(`${key}: ${value.length} item(s)`);
      continue;
    }

    if (isRecord(value)) {
      console.log(`${key}: ${JSON.stringify(value)}`);
      continue;
    }

    console.log(`${key}: ${formatCell(value)}`);
  }
}

function findFirstArrayEntry(record: Record<string, unknown>): [string, unknown[]] | null {
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      return [key, value];
    }
  }

  return null;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return truncate(value, 80);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return truncate(JSON.stringify(value), 80);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactSensitiveOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveOutput);
  }

  if (!isRecord(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_OUTPUT_KEYS.has(key)) {
      continue;
    }
    redacted[key] = redactSensitiveOutput(child);
  }
  return redacted;
}
