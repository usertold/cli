import type { ParsedArgs } from '../lib/types';
import {
  hasHelpFlag,
  parseEnvironment,
} from '../lib/args';
import { requestProjectContract } from '../lib/contract-api';
import { isJsonOutput, printOutput } from '../lib/output';
import { consumeProjectRef } from '../lib/project-defaults';
import type { DashboardApiResponse } from '../../shared/api-contracts';
import { printCommandHelp } from './help-manifest';

// ─── Types ───────────────────────────────────────────────────────────────────

type OverviewData = DashboardApiResponse<'overview'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function check(value: boolean): string {
  return value ? '[x]' : '[ ]';
}

function formatSignalBreakdown(byType: Record<string, number>): string {
  const parts = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${count} ${type}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function formatTaskBreakdown(byStatus: Record<string, number>): string {
  const parts = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `${count} ${status}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function formatOverview(data: OverviewData): void {
  const { sessions, signals, tasks, intakes, setup, recent_sessions, top_tasks } = data;

  console.log(`Interviews:  ${sessions.total} total (${sessions.completed} completed, ${sessions.active} active)`);
  console.log(`Evidence:    ${signals.total} total${formatSignalBreakdown(signals.by_type)}`);
  console.log(`Findings:    ${tasks.total} total${formatTaskBreakdown(tasks.by_status)}`);
  console.log(`Intakes:     ${intakes.total} total (${intakes.active} active, ${intakes.total_completed} completed, ${intakes.total_qualified} qualified)`);
  console.log('');

  console.log('Setup:');
  console.log(`  ${check(setup.has_api_keys)} API keys configured`);
  console.log(`  ${check(setup.has_active_study)} Active study`);
  console.log(`  ${check(setup.has_active_intake)} Active intake`);
  console.log(`  ${check(setup.has_linked_active_intake)} Active intake linked to study`);
  console.log(`  ${check(setup.has_sessions)} Has interviews`);

  if (recent_sessions.length > 0) {
    console.log('');
    console.log('Recent interviews:');
    for (const s of recent_sessions) {
      const name = s.participant_name || 'anonymous';
      const dur = formatDuration(s.duration_seconds);
      const date = formatDate(s.created_at);
      const id = s.id.length > 12 ? `${s.id.slice(0, 12)}...` : s.id;
      console.log(`  ${id}  ${s.status.padEnd(10)}  ${dur.padEnd(8)}  ${String(s.signal_count).padStart(2)} evidence  ${date}  ${name}`);
    }
  }

  if (top_tasks.length > 0) {
    console.log('');
    console.log('Top Findings:');
    for (const t of top_tasks) {
      const id = t.id.length > 12 ? `${t.id.slice(0, 12)}...` : t.id;
      const title = t.title.length > 50 ? `${t.title.slice(0, 47)}...` : t.title;
      console.log(`  ${id}  p${String(t.priority_score).padStart(2)}  ${String(t.signal_count).padStart(2)} evidence  ${title}`);
    }
  }
}

// ─── Command ─────────────────────────────────────────────────────────────────

export async function handleOverviewCommand(parsed: ParsedArgs): Promise<void> {
  if (hasHelpFlag(parsed)) {
    printCommandHelp('project', 'overview');
    return;
  }

  const env = parseEnvironment(parsed);
  const { projectRef } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'overview' });

  const data = await requestProjectContract({
    env,
    key: 'overview',
    projectRef,
    sourceLabel: '<projectRef>',
  });

  if (isJsonOutput(parsed)) {
    printOutput(data, parsed);
  } else {
    formatOverview(data);
  }
}
