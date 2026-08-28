import type { ParsedArgs } from './types';

/**
 * Returns true if we're in an interactive TTY context.
 * Returns false when:
 * - stdout is not a TTY (piped)
 * - --yes flag is set
 * - USERTOLD_API_KEY env var is set (automation mode)
 */
export function isInteractive(parsed: ParsedArgs): boolean {
  if (!process.stdout.isTTY) return false;
  if (parsed.options.yes === 'true' || parsed.options.y === 'true') return false;
  if (process.env.USERTOLD_API_KEY) return false;
  return true;
}
