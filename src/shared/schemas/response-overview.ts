import { z } from 'zod';
import { ApiSessionSchema } from './response-sessions';
import { ApiTaskSchema } from './response-tasks';

export const ApiOverviewSetupStartBlockerSchema = z.enum([
  'insufficient_credits',
  'openai_key_missing',
  'byok_key_unavailable',
  'billing_error',
]);
export type ApiOverviewSetupStartBlocker = z.infer<typeof ApiOverviewSetupStartBlockerSchema>;

export const ApiOverviewResponseSchema = z.object({
  sessions: z.object({
    total: z.number(),
    active: z.number(),
    completed: z.number(),
    by_status: z.record(z.string(), z.number()),
    failed_extraction: z.number(),
    with_evidence: z.number(),
    needs_attention: z.number(),
    by_review_state: z.record(z.string(), z.number()),
  }),
  signals: z.object({ total: z.number(), by_type: z.record(z.string(), z.number()) }),
  tasks: z.object({ total: z.number(), by_status: z.record(z.string(), z.number()) }),
  attention: z.object({
    recent_sessions_with_evidence: z.number(),
    active_evidence: z.number(),
    /** Active evidence outside any work item (target surface: all) — the
     * triage-debt figure the console's rail and Home attention row share. */
    unlinked_evidence: z.number(),
    tasks_awaiting_handoff: z.number(),
    tasks_in_linear: z.number(),
    recurrence_candidates: z.number(),
  }),
  intakes: z.object({ total: z.number(), active: z.number(), total_completed: z.number(), total_qualified: z.number() }),
  recent_sessions: z.array(ApiSessionSchema),
  top_tasks: z.array(ApiTaskSchema),
  setup: z.object({
    has_api_keys: z.boolean(),
    can_start_interviews: z.boolean(),
    start_blocker: ApiOverviewSetupStartBlockerSchema.nullable(),
    has_active_study: z.boolean(),
    has_active_intake: z.boolean(),
    has_linked_active_intake: z.boolean(),
    has_sessions: z.boolean(),
  }),
});
export type ApiOverviewResponse = z.infer<typeof ApiOverviewResponseSchema>;
