import type { ParsedArgs } from '../lib/types';
import {
  getBooleanOption,
  hasHelpFlag,
  parseEnvironment,
  parseJsonOrFile,
  requireOption,
} from '../lib/args';

import { fail } from '../lib/errors';
import { requestProjectContractJson } from '../lib/contract-api';
import { isJsonOutput, printOutput } from '../lib/output';
import { consumeProjectRef } from '../lib/project-defaults';
import { printCommandHelp } from './help-manifest';

export async function handleScreenerCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('intake');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'list': {
      const { projectRef: projectId } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'intake list' });

      const data = await requestProjectContractJson('intakesList', {
        env,
        projectRef: projectId,
      });
      printOutput(data, parsed);
      return;
    }

    case 'create': {
      const { projectRef: projectId } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'intake create' });

      const title = requireOption(parsed, 'title');
      const body: Record<string, unknown> = { title };

      if (parsed.options.handle && parsed.options.handle !== 'true') {
        body.handle = parsed.options.handle;
      }

      // Optional string fields
      for (const field of ['description', 'welcome-message', 'consent-text', 'brand-color']) {
        const key = field.replace(/-/g, '_');
        const val = parsed.options[field];
        if (val && val !== 'true') {
          body[key] = val;
        }
      }

      // Optional number fields
      if (parsed.options['max-participants'] && parsed.options['max-participants'] !== 'true') {
        body.max_participants = parseInt(parsed.options['max-participants'], 10);
      }
      // Questions: --questions <json|@file>
      const questionsInput = parsed.options.questions;
      if (questionsInput && questionsInput !== 'true') {
        body.questions = await parseJsonOrFile(questionsInput, '--questions');
      }

      const data = await requestProjectContractJson('intakeCreate', {
        env,
        projectRef: projectId,
        body,
      });

      // Auto-activate if --activate flag is set
      if (getBooleanOption(parsed, 'activate')) {
        const screener = (data as Record<string, unknown>).intake as Record<string, unknown> | undefined;
        const intakeRef = screener?.ref as string | undefined;
        if (intakeRef) {
          await requestProjectContractJson('intakePatch', {
            env,
            projectRef: projectId,
            pathParams: { intakeRef: intakeRef },
            body: { status: 'active' },
          });
          (screener as Record<string, unknown>).status = 'active';
        }
      }

      printOutput(data, parsed);

      if (!isJsonOutput(parsed)) {
        const screener = (data as Record<string, unknown>).intake as Record<string, unknown> | undefined;
        const intakeRef = screener?.ref as string | undefined;
        if (intakeRef) {
          console.log('\n--- Next steps ---');
          if (!getBooleanOption(parsed, 'activate')) {
            console.log(`Activate intake:            usertold intake update ${projectId} ${intakeRef} --status active --env ${env}`);
          }
          console.log(`Link intake to a v2 study:  usertold study update ${projectId} <studyRef> --intake ${intakeRef} --env ${env}`);
        }
      }
      return;
    }

    case 'get': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'intake get' });
      const intakeRef = args[0];

      const data = await requestProjectContractJson('intakeGet', {
        env,
        projectRef: projectId,
        pathParams: { intakeRef },
      });
      printOutput(data, parsed);
      return;
    }

    case 'update': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'intake update' });
      const intakeRef = args[0];

      const body: Record<string, unknown> = {};

      for (const field of ['title', 'description', 'status', 'welcome-message', 'thank-you-message', 'disqualified-message', 'brand-color', 'consent-text']) {
        const key = field.replace(/-/g, '_');
        const val = parsed.options[field];
        if (val && val !== 'true') {
          body[key] = val;
        }
      }

      if (parsed.options['max-participants'] && parsed.options['max-participants'] !== 'true') {
        body.max_participants = parseInt(parsed.options['max-participants'], 10);
      }

      if (Object.keys(body).length === 0) {
        fail('No update fields provided. Use --title, --description, --status, --welcome-message, etc.');
      }

      const data = await requestProjectContractJson('intakePatch', {
        env,
        projectRef: projectId,
        pathParams: { intakeRef },
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'delete': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'intake delete' });
      const intakeRef = args[0];

      const data = await requestProjectContractJson('intakeDelete', {
        env,
        projectRef: projectId,
        pathParams: { intakeRef },
      });
      printOutput(data, parsed);
      return;
    }

    case 'set-questions': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'intake set-questions' });
      const intakeRef = args[0];

      const questionsInput = requireOption(parsed, 'questions');
      const questions = await parseJsonOrFile(questionsInput, '--questions');

      const data = await requestProjectContractJson('intakeSetQuestions', {
        env,
        projectRef: projectId,
        pathParams: { intakeRef },
        body: { questions },
      });
      printOutput(data, parsed);
      return;
    }

    case 'list-responses': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'intake list-responses' });
      const intakeRef = args[0];

      const data = await requestProjectContractJson('intakeGet', {
        env,
        projectRef: projectId,
        pathParams: { intakeRef },
      }) as Record<string, unknown>;

      if (isJsonOutput(parsed)) {
        const responses = data.responses ?? [];
        console.log(JSON.stringify(responses, null, 2));
      } else {
        printOutput({ responses: data.responses }, parsed);
      }
      return;
    }

    case 'get-response': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 2, commandLabel: 'intake get-response' });
      const [intakeRef, responseId] = args;

      const data = await requestProjectContractJson('intakeResponseGet', {
        env,
        projectRef: projectId,
        pathParams: {
          intakeRef,
          responseId,
        },
      });
      printOutput(data, parsed);
      return;
    }

    case 'qualify-response': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 2, commandLabel: 'intake qualify-response' });
      const [intakeRef, responseId] = args;

      const reason = parsed.options.reason && parsed.options.reason !== 'true' ? parsed.options.reason : undefined;

      const data = await requestProjectContractJson('intakeResponsePatch', {
        env,
        projectRef: projectId,
        pathParams: {
          intakeRef,
          responseId,
        },
        body: { qualified: true, reason },
      });
      printOutput(data, parsed);
      return;
    }

    case 'disqualify-response': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 2, commandLabel: 'intake disqualify-response' });
      const [intakeRef, responseId] = args;

      const reason = requireOption(parsed, 'reason');

      const data = await requestProjectContractJson('intakeResponsePatch', {
        env,
        projectRef: projectId,
        pathParams: {
          intakeRef,
          responseId,
        },
        body: { qualified: false, reason },
      });
      printOutput(data, parsed);
      return;
    }

    default:
      fail(`Unknown intake command: ${subcommand}`);
  }
}
