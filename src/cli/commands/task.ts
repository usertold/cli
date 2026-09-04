import type { ParsedArgs } from '../lib/types';
import {
  hasHelpFlag,
  parseEnvironment,
  requireOption,
} from '../lib/args';

import { requestProjectContract } from '../lib/contract-api';
import { fail } from '../lib/errors';
import type { ApiResponse, RequestRetryOptions } from '../lib/http';
import { isCloudflare1010Response } from '../lib/http';
import { printOutput } from '../lib/output';
import { consumeProjectRef } from '../lib/project-defaults';
import { printCommandHelp } from './help-manifest';

const FINDING_SEND_RETRY_OPTIONS: RequestRetryOptions = {
  retries: 4,
  initialDelayMs: 500,
  maxDelayMs: 4_000,
  shouldRetry: ({ response, error }) => isRetryableFindingSendFailure(response, error),
};

const FINDING_STATES_BY_LEGACY_STATUS = {
  backlog: { research_state: 'draft', delivery_state: 'not_sent' },
  ready: { research_state: 'reviewed', delivery_state: 'not_sent' },
  in_progress: { research_state: 'reviewed', delivery_state: 'in_progress' },
  done: { research_state: 'closed', delivery_state: 'completed' },
  wont_fix: { research_state: 'closed', delivery_state: 'declined' },
} as const;

function findingStatesForStatus(status: string): (typeof FINDING_STATES_BY_LEGACY_STATUS)[keyof typeof FINDING_STATES_BY_LEGACY_STATUS] {
  const states = FINDING_STATES_BY_LEGACY_STATUS[status as keyof typeof FINDING_STATES_BY_LEGACY_STATUS];
  if (!states) fail('--status must be one of: backlog, ready, in_progress, done, wont_fix');
  return states;
}

export async function handleFindingCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('findings');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'list': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'findings list' });

      const query: {
        research_state?: string;
        delivery_state?: string;
        target_surface?: string;
        evidence_interview_ref?: string;
        min_priority?: string;
        limit?: string;
        offset?: string;
      } = {};
      if (parsed.options.status && parsed.options.status !== 'true') {
        Object.assign(query, findingStatesForStatus(parsed.options.status));
      }
      if (parsed.options['target-surface'] && parsed.options['target-surface'] !== 'true') {
        query.target_surface = parsed.options['target-surface'];
      }
      if (parsed.options.interview && parsed.options.interview !== 'true') {
        query.evidence_interview_ref = parsed.options.interview;
      }
      if (parsed.options['min-priority'] && parsed.options['min-priority'] !== 'true') {
        query.min_priority = parsed.options['min-priority'];
      }
      if (parsed.options.limit && parsed.options.limit !== 'true') {
        query.limit = parsed.options.limit;
      }
      if (parsed.options.offset && parsed.options.offset !== 'true') {
        query.offset = parsed.options.offset;
      }

      const data = await requestProjectContract({
        env,
        key: 'findingsList',
        projectRef,
        sourceLabel: '<projectRef>',
        query,
      });
      printOutput(data, parsed);
      return;
    }

    case 'get': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'findings get' });
      const findingRef = args[0];

      const data = await requestProjectContract({
        env,
        key: 'findingGet',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { findingRef },
      });
      printOutput(data, parsed);
      return;
    }

    case 'create': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'findings create' });

      const title = requireOption(parsed, 'title');
      const body: Record<string, unknown> = { title };

      if (parsed.options.description && parsed.options.description !== 'true') {
        body.description = parsed.options.description;
      }
      if (parsed.options.effort && parsed.options.effort !== 'true') {
        body.effort_estimate = parsed.options.effort;
      }
      if (parsed.options.priority && parsed.options.priority !== 'true') {
        body.priority_score = parseInt(parsed.options.priority, 10);
      }

      const data = await requestProjectContract({
        env,
        key: 'findingCreate',
        projectRef,
        sourceLabel: '<projectRef>',
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'update': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'findings update' });
      const findingRef = args[0];

      const body: Record<string, unknown> = {};
      if (parsed.options.title && parsed.options.title !== 'true') {
        body.title = parsed.options.title;
      }
      if (parsed.options.description && parsed.options.description !== 'true') {
        body.description = parsed.options.description;
      }
      if (parsed.options.status && parsed.options.status !== 'true') {
        Object.assign(body, findingStatesForStatus(parsed.options.status));
      }
      if (parsed.options.effort && parsed.options.effort !== 'true') {
        body.effort_estimate = parsed.options.effort;
      }
      if (parsed.options.priority && parsed.options.priority !== 'true') {
        body.priority_score = parseInt(parsed.options.priority, 10);
      }

      if (Object.keys(body).length === 0) {
        fail('No update fields provided. Use --title, --description, --status, --effort, --priority');
      }

      const data = await requestProjectContract({
        env,
        key: 'findingPatch',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { findingRef },
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'delete': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'findings delete' });
      const findingRef = args[0];

      const data = await requestProjectContract({
        env,
        key: 'findingDelete',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { findingRef },
      });
      printOutput(data, parsed);
      return;
    }

    case 'push-status': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'findings push-status' });
      const findingRef = args[0];

      const data = await requestProjectContract({
        env,
        key: 'findingProviderStates',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { findingRef },
      });
      printOutput(data, parsed);
      return;
    }

    case 'push': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'findings push' });
      const findingRef = args[0];

      const provider = parsed.options.provider && parsed.options.provider !== 'true'
        ? parsed.options.provider
        : null;

      if (provider && provider !== 'github' && provider !== 'linear' && provider !== 'auto') {
        fail('--provider must be one of: github, linear, auto');
      }

      const data = await requestProjectContract({
        env,
        key: 'findingSend',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { findingRef },
        body: provider ? { provider } : {},
        retryOptions: FINDING_SEND_RETRY_OPTIONS,
      });
      printOutput(data, parsed);
      return;
    }

    case 'create-from-evidence': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'findings create-from-evidence' });
      const title = requireOption(parsed, 'title');
      const evidenceStr = requireOption(parsed, 'evidence');
      const evidenceRefs = evidenceStr.split(',').map(s => s.trim()).filter(Boolean);
      if (evidenceRefs.length === 0) {
        fail('--evidence must contain at least one evidence ID');
      }
      const body: Record<string, unknown> = { title, evidence_refs: evidenceRefs };
      if (parsed.options.description && parsed.options.description !== 'true') {
        body.description = parsed.options.description;
      }
      const data = await requestProjectContract({
        env,
        key: 'findingCreateFromEvidence',
        projectRef,
        sourceLabel: '<projectRef>',
        body,
      });
      printOutput(data, parsed);
      return;
    }

    default:
      fail(`Unknown findings command: ${subcommand}`);
  }
}


function isRetryableFindingSendFailure(response?: ApiResponse, error?: unknown): boolean {
  if (response) {
    if (response.status === 429) {
      return true;
    }

    if (response.status >= 500 && response.status <= 504) {
      return true;
    }

    return response.status === 403 && isCloudflare1010Response(response);
  }

  return error instanceof Error;
}
