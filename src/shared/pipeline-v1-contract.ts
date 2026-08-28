/**
 * Pipeline V1 contract.
 *
 * This module is the shared boundary between transcript processing,
 * extraction, Work grouping, CLI tooling, and worker orchestration.
 * Backend implementation modules may import it; shared consumers must not
 * import backend analytics internals for these shapes.
 */

import { z } from 'zod';
import { TARGET_SURFACES, type TargetSurface } from './target-surface';

export const PIPELINE_V1_CONTRACT_VERSION = 'pipeline.v1' as const;

/**
 * Typed error for signal extraction failures.
 * Thrown when the AI response cannot be parsed into valid signals.
 */
export class SignalExtractionError extends Error {
  constructor(
    message: string,
    public readonly rawText?: string,
    public readonly providerError?: {
      status: number;
      type?: string;
      code?: string;
      message?: string;
      param?: string;
    },
  ) {
    super(message);
    this.name = 'SignalExtractionError';
  }
}

/**
 * Hard ceiling on signals per session. Raised to accommodate chunked extraction
 * of long sessions — quality is controlled by dedup + confidence filtering.
 */
export const MAX_SIGNALS_PER_SESSION = 75;

/** Signals below this confidence after merge are dropped (thin chunk context). */
export const MIN_SIGNAL_CONFIDENCE = 0.3;

/**
 * Signals below this confidence are stored as review_status='calibration' —
 * hidden from default views and excluded from task creation.
 * Kept in DB for threshold tuning: review what the extractor produces at
 * low confidence to decide whether to raise or lower this cutoff.
 */
export const CALIBRATION_CONFIDENCE = 0.65;

/** Signal types that represent positive evidence (task completed without friction). */
export const POSITIVE_SIGNAL_TYPES = ['no_issue_found', 'smooth_completion'] as const;

export function isPositiveSignalType(type: string): boolean {
  return (POSITIVE_SIGNAL_TYPES as readonly string[]).includes(type);
}

export type EvidenceGrade = 'direct' | 'strong_circumstantial' | 'weak';

export const EVIDENCE_GRADES = ['direct', 'strong_circumstantial', 'weak'] as const;

export interface PipelineV1ExtractedSignal {
  signal_type: string;
  target_surface: TargetSurface;
  headline: string;
  quote: string;
  observed_facts: string[];
  claim: string;
  reconstruction: string;
  evidence_grade: EvidenceGrade;
  confidence: number;
  intensity: number;
  timestamp_ms: number;
  window_start_ms: number;
  window_end_ms: number;
  segment_id?: string;
  page_url?: string | null;
  page_title?: string | null;
  preceding_actions?: string[] | null;
  user_goal?: string | null;
  outcome?: string | null;
  transcript_uncertain: boolean;
  transcript_uncertainty_note?: string | null;
}

export const PIPELINE_V1_SIGNAL_TYPES = [
  'struggling_moment',
  'desired_outcome',
  'workaround',
  'hiring_criteria',
  'firing_moment',
  'emotional_response',
  'no_issue_found',
  'smooth_completion',
  'critical_error',
  'recovery_success',
  'decision_point',
] as const;
export type PipelineV1SignalType = typeof PIPELINE_V1_SIGNAL_TYPES[number];

export const pipelineV1ExtractedSignalSchema = z.object({
  signal_type: z.enum(PIPELINE_V1_SIGNAL_TYPES),
  target_surface: z.enum(TARGET_SURFACES),
  headline: z.string().min(1),
  quote: z.string(),
  observed_facts: z.array(z.string().min(1)),
  claim: z.string().min(1),
  reconstruction: z.string().min(1),
  evidence_grade: z.enum(EVIDENCE_GRADES),
  confidence: z.number().transform(v => Math.min(1, Math.max(0, v))),
  intensity: z.number().nullish().transform(v => {
    if (v == null) return 0.5;
    const normalized = v > 1 ? v / 100 : v;
    return Math.min(1, Math.max(0, normalized));
  }),
  timestamp_ms: z.number(),
  window_start_ms: z.number(),
  window_end_ms: z.number(),
  segment_id: z.string().optional(),
  page_url: z.string().nullish(),
  page_title: z.string().nullish(),
  preceding_actions: z.array(z.string()).nullish(),
  user_goal: z.string().nullish(),
  outcome: z.string().nullish(),
  transcript_uncertain: z.boolean(),
  transcript_uncertainty_note: z.string().nullish(),
}).strict().superRefine((signal, ctx) => {
  const hasQuote = signal.quote.trim().length > 0;
  const hasObservedFacts = signal.observed_facts?.some(fact => fact.trim().length > 0) ?? false;
  if (!hasQuote && !hasObservedFacts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quote'],
      message: 'Evidence requires a participant quote or at least one observed fact',
    });
  }
});

export type ExtractedSignal = PipelineV1ExtractedSignal;
export const extractedSignalSchema = pipelineV1ExtractedSignalSchema;

/**
 * Stored Evidence also includes reviewer-authored cards. Those cards preserve
 * absent generated layers as absent instead of fabricating extraction output,
 * while keeping the same structured forensic vocabulary and grounding gate.
 */
export const pipelineV1EvidenceCardSignalSchema = z.object({
  signal_type: z.enum(PIPELINE_V1_SIGNAL_TYPES),
  target_surface: z.enum(TARGET_SURFACES),
  headline: z.string().min(1).optional(),
  quote: z.string(),
  observed_facts: z.array(z.string().min(1)).optional(),
  claim: z.string().min(1).optional(),
  reconstruction: z.string().min(1).optional(),
  evidence_grade: z.enum(EVIDENCE_GRADES),
  confidence: z.number().min(0).max(1),
  intensity: z.number().nullish().transform(v => {
    if (v == null) return 0.5;
    const normalized = v > 1 ? v / 100 : v;
    return Math.min(1, Math.max(0, normalized));
  }),
  timestamp_ms: z.number().optional(),
  window_start_ms: z.number().optional(),
  window_end_ms: z.number().optional(),
  segment_id: z.string().optional(),
  page_url: z.string().nullish(),
  page_title: z.string().nullish(),
  preceding_actions: z.array(z.string()).nullish(),
  user_goal: z.string().nullish(),
  outcome: z.string().nullish(),
  transcript_uncertain: z.boolean(),
  transcript_uncertainty_note: z.string().nullish(),
}).strict().superRefine((signal, ctx) => {
  const hasQuote = signal.quote.trim().length > 0;
  const hasObservedFacts = signal.observed_facts?.some(fact => fact.trim().length > 0) ?? false;
  if (!hasQuote && !hasObservedFacts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quote'],
      message: 'Evidence requires a participant quote or at least one observed fact',
    });
  }
});

export const pipelineV1WorkProblemStatementSchema = z.object({
  title: z.string().trim().min(1).max(80),
  problem_statement: z.string().trim().min(1),
}).strict();
export type PipelineV1WorkProblemStatement = z.output<typeof pipelineV1WorkProblemStatementSchema>;

export const pipelineV1SignalGroupSchema = pipelineV1WorkProblemStatementSchema.extend({
  evidence_indices: z.array(z.number().int().nonnegative()),
}).strict();
export type SignalTheme = z.output<typeof pipelineV1SignalGroupSchema>;

export const PIPELINE_V1_ARTIFACT_KINDS = ['evidence_card', 'work'] as const;
export type PipelineV1ArtifactKind = typeof PIPELINE_V1_ARTIFACT_KINDS[number];

const pipelineV1ArtifactBaseFields = {
  contract_version: z.literal(PIPELINE_V1_CONTRACT_VERSION),
  artifact_kind: z.enum(PIPELINE_V1_ARTIFACT_KINDS),
  artifact_id: z.string().optional(),
  project_id: z.string().optional(),
  session_id: z.string().optional(),
  created_at: z.string().optional(),
} as const;

export const pipelineV1ArtifactBaseSchema = z.object(pipelineV1ArtifactBaseFields);
export type PipelineV1ArtifactBase = z.output<typeof pipelineV1ArtifactBaseSchema>;

export const pipelineV1EvidenceCardArtifactSchema = z.object({
  ...pipelineV1ArtifactBaseFields,
  artifact_kind: z.literal('evidence_card'),
  evidence: pipelineV1EvidenceCardSignalSchema,
}).strict();
export type PipelineV1EvidenceCardArtifact = z.output<typeof pipelineV1EvidenceCardArtifactSchema>;

export const pipelineV1WorkArtifactSchema = z.object({
  ...pipelineV1ArtifactBaseFields,
  artifact_kind: z.literal('work'),
  title: z.string().min(1),
  problem_statement: z.string().min(1),
  evidence_card_ids: z.array(z.string()),
  evidence_indices: z.array(z.number().int().nonnegative()).optional(),
}).strict();
export type PipelineV1WorkArtifact = z.output<typeof pipelineV1WorkArtifactSchema>;

export const pipelineV1ArtifactSchema = z.discriminatedUnion('artifact_kind', [
  pipelineV1EvidenceCardArtifactSchema,
  pipelineV1WorkArtifactSchema,
]);
export type PipelineV1Artifact = z.output<typeof pipelineV1ArtifactSchema>;

export interface PipelineV1StudySegmentContext {
  id: string;
  mode: string;
  title: string;
  /** Task instruction shown during observe mode */
  instruction?: string;
  /** Researcher's background context for AI (not shown to participant) */
  conductor_context?: string;
  /** Specific probing goals for talk segments */
  talk_goals?: string[];
}
export type StudySegmentContext = PipelineV1StudySegmentContext;

export interface PipelineV1StudyContext {
  goals: Array<{ id: string; description: string }>;
  segments?: PipelineV1StudySegmentContext[];
  /** Explicit researcher-written extraction guidance; future UI/API config should use this instead of hidden study taxonomies. */
  analysis_instructions?: string[];
}
export type StudyContext = PipelineV1StudyContext;

export interface PipelineV1SessionConductorData {
  completedGoalIds: string[];
  pinnedMoments: Array<{ text: string; reason: string; ts: number }>;
  transcriptSummaries: Array<{ text: string; fromTs: number; toTs: number }>;
  pageHistory?: Array<{ url: string; title: string; ts: number }>;
}
export type SessionConductorData = PipelineV1SessionConductorData;

/**
 * Try to extract a JSON array from text using multiple strategies:
 * 1. JSON.parse the full text
 * 2. Strip markdown fences and JSON.parse
 * 3. Regex fallback for the outermost [...] bracket pair
 */
export function extractJsonArray(text: string): unknown[] {
  // Strategy 1: try parsing the full text directly
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // continue to next strategy
  }

  // Strategy 2: strip markdown code fences and try again
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const fenceMatch = text.match(fencePattern);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // continue to next strategy
    }
  }

  // Strategy 3: find the outermost [ ... ] pair (non-greedy approach)
  const startIdx = text.indexOf('[');
  const endIdx = text.lastIndexOf(']');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      const parsed = JSON.parse(text.slice(startIdx, endIdx + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // all strategies failed
    }
  }

  throw new SignalExtractionError(
    'No valid JSON array found in signal extraction response',
    text.slice(0, 500),
  );
}

/**
 * Validate raw parsed signals against the Zod schema.
 * Returns valid signals and error messages for invalid ones.
 * Partial acceptance: valid signals are kept even when others fail.
 */
export function validatePipelineV1Signals(parsed: unknown[]): { valid: PipelineV1ExtractedSignal[]; errors: string[] } {
  const valid: PipelineV1ExtractedSignal[] = [];
  const errors: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const result = extractedSignalSchema.safeParse(parsed[i]);
    if (result.success) {
      const s = result.data;
      valid.push({
        signal_type: s.signal_type,
        target_surface: s.target_surface,
        headline: s.headline,
        quote: s.quote,
        observed_facts: s.observed_facts,
        claim: s.claim,
        reconstruction: s.reconstruction,
        evidence_grade: s.evidence_grade,
        confidence: s.confidence,
        intensity: s.intensity,
        timestamp_ms: s.timestamp_ms,
        window_start_ms: s.window_start_ms,
        window_end_ms: s.window_end_ms,
        segment_id: s.segment_id,
        page_url: s.page_url ?? undefined,
        page_title: s.page_title ?? undefined,
        preceding_actions: s.preceding_actions ?? undefined,
        user_goal: s.user_goal ?? undefined,
        outcome: s.outcome ?? undefined,
        transcript_uncertain: s.transcript_uncertain,
        transcript_uncertainty_note: s.transcript_uncertainty_note ?? undefined,
      });
    } else {
      const issues = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      errors.push(`signal[${i}]: ${issues}`);
    }
  }

  return { valid, errors };
}

export const validateSignals = validatePipelineV1Signals;
