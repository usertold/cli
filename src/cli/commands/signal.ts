import type { ParsedArgs } from '../lib/types';
import {
  getBooleanOption,
  hasHelpFlag,
  parseEnvironment,
  requireOption,
} from '../lib/args';

import { requestProjectContract } from '../lib/contract-api';
import { fail } from '../lib/errors';
import { isJsonOutput, printOutput } from '../lib/output';
import { consumeProjectRef } from '../lib/project-defaults';
import type { DashboardApiResponse } from '../../shared/api-contracts';
import { printCommandHelp } from './help-manifest';

export async function handleSignalCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('evidence');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'list': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'evidence list' });

      const query = buildSignalQuery(parsed);
      const data = await requestProjectContract({
        env,
        key: 'signalsList',
        projectRef,
        sourceLabel: '<projectRef>',
        query,
      });

      if (isJsonOutput(parsed)) {
        printOutput(data, parsed);
      } else {
        printSignalCards(data);
      }
      return;
    }

    case 'get': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence get' });
      const signalId = args[0];

      const data = await requestProjectContract({
        env,
        key: 'signalGet',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId: signalId },
      });
      printOutput(data, parsed);
      return;
    }

    case 'coverage-gaps': {
      const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'evidence coverage-gaps' });

      const data = await requestProjectContract({
        env,
        key: 'projectCoverageGaps',
        projectRef,
        sourceLabel: '<projectRef>',
      });

      if (isJsonOutput(parsed)) {
        printOutput(data, parsed);
      } else {
        printCoverageGaps(data);
      }
      return;
    }

    case 'case-file': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence case-file' });
      const signalId = args[0];

      const data = await requestProjectContract({
        env,
        key: 'signalGet',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId },
      });
      if (!data.signal.case_file) {
        fail(`Evidence ${signalId} does not have an Evidence Case File V1 representation`);
      }
      printOutput(data.signal.case_file, parsed);
      return;
    }

    case 'annotate': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence annotate' });
      const signalId = args[0];

      const text = requireOption(parsed, 'text');
      const data = await requestProjectContract({
        env,
        key: 'signalAnnotate',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId: signalId },
        body: { text },
      });
      printOutput(data, parsed);
      return;
    }

    case 'dismiss': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence dismiss' });
      const signalId = args[0];

      const reason = requireOption(parsed, 'reason');
      const data = await requestProjectContract({
        env,
        key: 'signalDismiss',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId: signalId },
        body: { reason },
      });
      printOutput(data, parsed);
      return;
    }

    case 'undismiss': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence undismiss' });
      const signalId = args[0];

      const data = await requestProjectContract({
        env,
        key: 'signalUndismiss',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId: signalId },
      });
      printOutput(data, parsed);
      return;
    }

    case 'link': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 2, commandLabel: 'evidence link' });
      const [signalId, taskId] = args;

      const data = await requestProjectContract({
        env,
        key: 'signalLink',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId: signalId },
        body: {
          task_id: taskId,
        },
      });
      printOutput(data, parsed);
      return;
    }

    case 'unlink': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence unlink' });
      const signalId = args[0];

      const data = await requestProjectContract({
        env,
        key: 'signalUnlink',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId: signalId },
      });
      printOutput(data, parsed);
      return;
    }

    case 'delete': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence delete' });
      const signalId = args[0];

      const data = await requestProjectContract({
        env,
        key: 'signalDelete',
        projectRef,
        sourceLabel: '<projectRef>',
        pathParams: { signalId: signalId },
      });
      printOutput(data, parsed);
      return;
    }

    case 'bulk-link': {
      const { projectRef, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'evidence bulk-link' });
      const taskId = args[0];

      const signalIds = parseSignalIdsOption(parsed);
      const data = await requestProjectContract({
        env,
        key: 'signalsBulkLink',
        projectRef,
        sourceLabel: '<projectRef>',
        body: {
          signal_ids: signalIds,
          task_id: taskId,
        },
      });
      printOutput(data, parsed);
      return;
    }

    default:
      fail(`Unknown evidence command: ${subcommand}`);
  }
}


type SignalListData = DashboardApiResponse<'signalsList'>;
type CoverageGapData = DashboardApiResponse<'projectCoverageGaps'>;

function printCoverageGaps(data: CoverageGapData): void {
  if (data.gaps.length === 0) {
    console.log('(no coverage gaps)');
    return;
  }

  console.log('Coverage gaps:');
  console.log(`  published_unlinked_evidence: ${data.totals.published_unlinked_evidence}`);
  console.log(`  repeated_needs_review_evidence: ${data.totals.repeated_needs_review_evidence}`);
  console.log(`  high_confidence_unlinked_evidence: ${data.totals.high_confidence_unlinked_evidence}`);
  console.log(`  work_with_weak_or_no_published_evidence: ${data.totals.work_with_weak_or_no_published_evidence}`);
  console.log('');

  for (const gap of data.gaps) {
    console.log(`[${gap.type}] ${gap.id}`);
    console.log(`  ${gap.summary}`);
    console.log(`  Area: ${gap.target_surface}`);
    if (gap.signal_type) {
      console.log(`  Evidence type: ${gap.signal_type}`);
    }
    if (gap.evidence_ids.length > 0) {
      console.log(`  Evidence: ${gap.evidence_ids.join(', ')}`);
    }
    if (gap.work_ids.length > 0) {
      console.log(`  Work: ${gap.work_ids.join(', ')}`);
    }
    console.log(`  Suggested action: ${gap.suggested_action}`);
    console.log('');
  }
}

function printSignalCards(data: SignalListData): void {
  const signals = data.signals;
  if (signals.length === 0) {
    console.log('(no evidence)');
    return;
  }

  for (const s of signals) {
    const conf = typeof s.confidence === 'number' ? `${Math.round(s.confidence * 100)}%` : '';
    console.log(`[${s.signal_type}] ${s.id}  (confidence: ${conf})`);
    console.log(`  Area: ${s.target_surface}`);
    if (s.headline?.trim()) console.log(`  Generated summary: ${s.headline.trim()}`);
    if (s.quote.trim()) console.log(`  Participant quote: "${s.quote.trim()}"`);
    const observedFacts = parseObservedFacts(s.observed_facts_json);
    if (observedFacts.length > 0) {
      console.log('  Observed behavior:');
      for (const fact of observedFacts) console.log(`    - ${fact}`);
    }
    const interpretation = s.claim?.trim();
    if (interpretation) {
      console.log(`  Interpretation: ${interpretation}`);
    }
    console.log('');
  }

  if (data.total !== undefined) {
    console.log(`Showing ${signals.length} of ${data.total} evidence`);
  }
}

function parseObservedFacts(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function buildSignalQuery(parsed: ParsedArgs): {
  type?: string;
  target_surface?: string;
  session_id?: string;
  task_id?: string;
  search?: string;
  min_confidence?: string;
  limit?: string;
  offset?: string;
  dismissed?: string;
} {
  const query: {
    type?: string;
    target_surface?: string;
    session_id?: string;
    task_id?: string;
    search?: string;
    min_confidence?: string;
    limit?: string;
    offset?: string;
    dismissed?: string;
  } = {};

  if (parsed.options.type && parsed.options.type !== 'true') {
    query.type = parsed.options.type;
  }
  if (parsed.options['target-surface'] && parsed.options['target-surface'] !== 'true') {
    query.target_surface = parsed.options['target-surface'];
  }
  if (parsed.options.interview && parsed.options.interview !== 'true') {
    query.session_id = parsed.options.interview;
  }
  if (parsed.options.work && parsed.options.work !== 'true') {
    query.task_id = parsed.options.work;
  }
  if (parsed.options.search && parsed.options.search !== 'true') {
    query.search = parsed.options.search;
  }
  if (parsed.options['min-confidence'] && parsed.options['min-confidence'] !== 'true') {
    query.min_confidence = parsed.options['min-confidence'];
  }
  if (parsed.options.limit && parsed.options.limit !== 'true') {
    query.limit = parsed.options.limit;
  }
  if (parsed.options.offset && parsed.options.offset !== 'true') {
    query.offset = parsed.options.offset;
  }

  // Dismissed filter: --dismissed shows only dismissed, --all shows everything, default excludes dismissed
  if (getBooleanOption(parsed, 'dismissed')) {
    query.dismissed = 'true';
  } else if (!getBooleanOption(parsed, 'all')) {
    query.dismissed = 'false';
  }

  return query;
}

function parseSignalIdsOption(parsed: ParsedArgs): string[] {
  const signalsStr = requireOption(parsed, 'evidence');
  const signalIds = signalsStr.split(',').map((signalId) => signalId.trim()).filter(Boolean);
  if (signalIds.length === 0) {
    fail('--evidence must contain at least one evidence ID');
  }
  return signalIds;
}
