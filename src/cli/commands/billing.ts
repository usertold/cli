import type { ParsedArgs } from '../lib/types';
import {
  assertNoExtraPositionals,
  hasHelpFlag,
  parseEnvironment,
} from '../lib/args';
import { requestContract } from '../lib/contract-api';
import { fail } from '../lib/errors';
import { printOutput } from '../lib/output';
import { printCommandHelp } from './help-manifest';


export async function handleBillingCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('billing');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'status': {
      assertNoExtraPositionals(parsed, 0);

      const data = await requestContract({
        env,
        key: 'billingStatus',
      });
      printOutput(data, parsed);
      return;
    }

    case 'history': {
      assertNoExtraPositionals(parsed, 0);

      const query: { limit?: string; offset?: string } = {};
      if (parsed.options.limit && parsed.options.limit !== 'true') {
        query.limit = parsed.options.limit;
      }
      if (parsed.options.offset && parsed.options.offset !== 'true') {
        query.offset = parsed.options.offset;
      }

      const data = await requestContract({
        env,
        key: 'billingEvents',
        query,
      });
      printOutput(data, parsed);
      return;
    }

    case 'interviews': {
      assertNoExtraPositionals(parsed, 0);

      const query: { limit?: string; offset?: string } = {};
      if (parsed.options.limit && parsed.options.limit !== 'true') query.limit = parsed.options.limit;
      if (parsed.options.offset && parsed.options.offset !== 'true') query.offset = parsed.options.offset;

      const data = await requestContract({ env, key: 'billingInterviews', query });
      printOutput(data, parsed);
      return;
    }

    default:
      fail(`Unknown billing command: ${subcommand}`);
  }
}
