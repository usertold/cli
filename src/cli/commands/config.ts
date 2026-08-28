import type { ParsedArgs } from '../lib/types';
import { hasHelpFlag, parseEnvironment, parseJsonOrFile, requireOption } from '../lib/args';

import { requestProjectContract } from '../lib/contract-api';
import { fail } from '../lib/errors';
import { printOutput } from '../lib/output';
import { consumeProjectRef } from '../lib/project-defaults';
import { ApiKnowledgeActionConfigInputSchema } from '../../shared/api-types';
import { printCommandHelp } from './help-manifest';

export async function handleKnowledgeCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('knowledge');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'show': {
      const { projectRef } = await consumeProjectRef(parsed, env, {
        resourceArgCount: 0,
        commandLabel: 'knowledge show',
      });
      const data = await requestProjectContract({
        env,
        key: 'knowledgeActionGet',
        projectRef,
        sourceLabel: '--project',
      });
      printOutput(data, parsed);
      return;
    }

    case 'apply': {
      const { projectRef } = await consumeProjectRef(parsed, env, {
        resourceArgCount: 0,
        commandLabel: 'knowledge apply',
      });
      const raw = await parseJsonOrFile(requireOption(parsed, 'data'), '--data');
      const validated = ApiKnowledgeActionConfigInputSchema.safeParse(raw);
      if (!validated.success) {
        fail(`Invalid knowledge action: ${validated.error.issues.map((issue) => issue.message).join('; ')}`);
      }
      const data = await requestProjectContract({
        env,
        key: 'knowledgeActionPatch',
        projectRef,
        sourceLabel: '--project',
        body: validated.data,
      });
      printOutput(data, parsed);
      return;
    }

    case 'delete': {
      const { projectRef } = await consumeProjectRef(parsed, env, {
        resourceArgCount: 0,
        commandLabel: 'knowledge delete',
      });
      const data = await requestProjectContract({
        env,
        key: 'knowledgeActionDelete',
        projectRef,
        sourceLabel: '--project',
      });
      printOutput(data, parsed);
      return;
    }

    case 'test': {
      const { projectRef } = await consumeProjectRef(parsed, env, {
        resourceArgCount: 0,
        commandLabel: 'knowledge test',
      });
      const draftInput = parsed.options.data
        ? await parseJsonOrFile(parsed.options.data, '--data')
        : undefined;
      const validatedDraft = draftInput === undefined
        ? undefined
        : ApiKnowledgeActionConfigInputSchema.safeParse(draftInput);
      if (validatedDraft && !validatedDraft.success) {
        fail(`Invalid knowledge action: ${validatedDraft.error.issues.map((issue) => issue.message).join('; ')}`);
      }
      const data = await requestProjectContract({
        env,
        key: 'knowledgeActionTest',
        projectRef,
        sourceLabel: '--project',
        body: {
          query: requireOption(parsed, 'query'),
          ...(parsed.options['page-url'] ? { page_url: parsed.options['page-url'] } : {}),
          ...(parsed.options['site-hostname'] ? { site_hostname: parsed.options['site-hostname'] } : {}),
          ...(validatedDraft?.success ? { action: validatedDraft.data } : {}),
        },
      });
      printOutput(data, parsed);
      return;
    }

    default:
      fail(`Unknown knowledge command: ${subcommand}`);
  }
}
