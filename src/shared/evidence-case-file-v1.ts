import { z } from 'zod';
import {
  EVIDENCE_GRADES,
  PIPELINE_V1_CONTRACT_VERSION,
  PIPELINE_V1_SIGNAL_TYPES,
  pipelineV1EvidenceCardArtifactSchema,
  type EvidenceGrade,
  type PipelineV1SignalType,
} from './pipeline-v1-contract';

export const EVIDENCE_CASE_FILE_V1_VERSION = 'evidence_case_file.v1' as const;

const caseFileLinkedTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  linear_issue_id: z.string().nullable().optional(),
  linear_issue_url: z.string().nullable().optional(),
  linear_issue_status: z.string().nullable().optional(),
});

const caseFileEvidenceResolutionSchema = z.object({
  link_id: z.string(),
  task_id: z.string().optional(),
  linked_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolved_by_provider: z.string().nullable(),
  resolved_by_provider_issue_id: z.string().nullable(),
  resolution_reason: z.string().nullable(),
});

const caseFileRecurrenceCandidateSchema = z.object({
  id: z.string(),
  related_task_id: z.string(),
  related_resolved_signal_id: z.string().nullable(),
  confidence: z.number(),
  reason: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
  related_task: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
  }).nullable().optional(),
});

export const evidenceCaseFileV1ProvenanceSchema = z.object({
  study: z.object({ handle: z.string(), title: z.string() }).nullable(),
  interview: z.object({
    id: z.string(),
    participant_name: z.string().nullable(),
    started_at: z.string().nullable(),
    interview_mode: z.string().nullable(),
    duration_seconds: z.number().nullable(),
  }).nullable(),
  page: z.object({ url: z.string().nullable(), title: z.string().nullable() }).nullable(),
  timestamp_ms: z.number().nullable(),
  source: z.string().nullable(),
});

export const evidenceCaseFileV1Schema = z.object({
  case_file_version: z.literal(EVIDENCE_CASE_FILE_V1_VERSION),
  evidence_card: pipelineV1EvidenceCardArtifactSchema,
  provenance: evidenceCaseFileV1ProvenanceSchema.nullable(),
  review: z.object({
    review_status: z.string().nullable(),
    review_note: z.string().nullable(),
    annotation_text: z.string().nullable(),
    annotation_by: z.string().nullable(),
    annotation_at: z.string().nullable(),
    dismissed_at: z.string().nullable(),
    dismissed_reason: z.string().nullable(),
    dismissed_by: z.string().nullable(),
  }),
  links: z.object({
    linked_task: caseFileLinkedTaskSchema.nullable().optional(),
    evidence_resolution: caseFileEvidenceResolutionSchema.nullable().optional(),
    recurrence_candidates: z.array(caseFileRecurrenceCandidateSchema),
  }),
});
export type EvidenceCaseFileV1 = z.output<typeof evidenceCaseFileV1Schema>;

export interface EvidenceCaseFileV1SignalInput {
  id: string;
  project_id: string;
  session_id: string;
  created_at: string;
  signal_type: string;
  target_surface: string;
  quote: string;
  confidence: number;
  intensity: number | null;
  timestamp_ms: number | null;
  segment_id: string | null;
  page_url: string | null;
  page_title: string | null;
  preceding_actions: string | null;
  user_goal: string | null;
  outcome: string | null;
  headline?: string | null;
  claim?: string | null;
  reconstruction?: string | null;
  observed_facts_json?: string | null;
  evidence_grade?: string | null;
  window_start_ms?: number | null;
  window_end_ms?: number | null;
  transcript_uncertain: boolean;
  transcript_uncertainty_note: string | null;
  review_status?: string | null;
  review_note?: string | null;
  annotation_text: string | null;
  annotation_by: string | null;
  annotation_at: string | null;
  dismissed_at: string | null;
  dismissed_reason: string | null;
  dismissed_by: string | null;
  linked_task?: z.input<typeof caseFileLinkedTaskSchema> | null;
  evidence_resolution?: z.input<typeof caseFileEvidenceResolutionSchema> | null;
  recurrence_candidates?: Array<z.input<typeof caseFileRecurrenceCandidateSchema>>;
  provenance?: z.input<typeof evidenceCaseFileV1ProvenanceSchema> | null;
}

export function buildEvidenceCaseFileV1(signal: EvidenceCaseFileV1SignalInput): EvidenceCaseFileV1 | null {
  if (!isPipelineV1SignalType(signal.signal_type)) {
    return null;
  }

  const quote = signal.quote.trim();
  const observedFacts = parseStringArray(signal.observed_facts_json ?? null);
  if (!quote && !observedFacts) {
    return null;
  }

  const evidenceCard = pipelineV1EvidenceCardArtifactSchema.parse({
    contract_version: PIPELINE_V1_CONTRACT_VERSION,
    artifact_kind: 'evidence_card',
    artifact_id: signal.id,
    project_id: signal.project_id,
    session_id: signal.session_id,
    created_at: signal.created_at,
    evidence: {
      signal_type: signal.signal_type,
      target_surface: signal.target_surface,
      quote,
      confidence: signal.confidence,
      intensity: signal.intensity ?? undefined,
      timestamp_ms: signal.timestamp_ms ?? undefined,
      segment_id: emptyToUndefined(signal.segment_id),
      page_url: emptyToUndefined(signal.page_url),
      page_title: emptyToUndefined(signal.page_title),
      preceding_actions: parseStringArray(signal.preceding_actions),
      user_goal: emptyToUndefined(signal.user_goal),
      outcome: emptyToUndefined(signal.outcome),
      headline: emptyToUndefined(signal.headline ?? null),
      claim: emptyToUndefined(signal.claim ?? null),
      reconstruction: emptyToUndefined(signal.reconstruction ?? null),
      observed_facts: observedFacts,
      evidence_grade: normalizeEvidenceGrade(signal.evidence_grade),
      window_start_ms: signal.window_start_ms ?? undefined,
      window_end_ms: signal.window_end_ms ?? undefined,
      transcript_uncertain: signal.transcript_uncertain,
      transcript_uncertainty_note: emptyToUndefined(signal.transcript_uncertainty_note),
    },
  });

  return evidenceCaseFileV1Schema.parse({
    case_file_version: EVIDENCE_CASE_FILE_V1_VERSION,
    evidence_card: evidenceCard,
    provenance: signal.provenance ?? null,
    review: {
      review_status: signal.review_status ?? null,
      review_note: signal.review_note ?? null,
      annotation_text: signal.annotation_text ?? null,
      annotation_by: signal.annotation_by ?? null,
      annotation_at: signal.annotation_at ?? null,
      dismissed_at: signal.dismissed_at ?? null,
      dismissed_reason: signal.dismissed_reason ?? null,
      dismissed_by: signal.dismissed_by ?? null,
    },
    links: {
      linked_task: signal.linked_task ?? null,
      evidence_resolution: signal.evidence_resolution ?? null,
      recurrence_candidates: signal.recurrence_candidates ?? [],
    },
  });
}

function emptyToUndefined(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseStringArray(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const strings = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return strings.length > 0 ? strings : undefined;
  } catch {
    return undefined;
  }
}

function normalizeEvidenceGrade(value: string | null | undefined): EvidenceGrade {
  return (EVIDENCE_GRADES as readonly string[]).includes(value ?? '')
    ? value as EvidenceGrade
    : 'weak';
}

function isPipelineV1SignalType(value: string): value is PipelineV1SignalType {
  return (PIPELINE_V1_SIGNAL_TYPES as readonly string[]).includes(value);
}
