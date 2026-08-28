import { z } from 'zod';
import { INTERVIEW_MODES, SESSION_STATUSES } from '../constants';
import { CAPTURE_STATES, INTERVIEW_STATE_TONES, PRIMARY_INTERVIEW_ACTIONS, RESULTS_STATES, REVIEW_STATES } from '../session-state';

export const ApiInterviewStateSchema = z.object({
  capture_state: z.enum(CAPTURE_STATES),
  results_state: z.enum(RESULTS_STATES),
  review_state: z.enum(REVIEW_STATES),
  label: z.string(),
  tone: z.enum(INTERVIEW_STATE_TONES),
  primary_action: z.enum(PRIMARY_INTERVIEW_ACTIONS),
});
export type ApiInterviewState = z.infer<typeof ApiInterviewStateSchema>;

export const ApiSessionSchema = z.object({
  id: z.string(),
  project_ref: z.string(),
  study_ref: z.string().nullable(),
  intake_response_id: z.string().nullable(),
  participant_name: z.string().nullable(),
  participant_email: z.string().nullable(),
  status: z.enum(SESSION_STATUSES),
  interview_mode: z.enum(INTERVIEW_MODES),
  current_phase: z.string().nullable(),
  phase_started_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  transcript_key: z.string().nullable(),
  voice_vtt_key: z.string().nullable(),
  actions_vtt_key: z.string().nullable(),
  session_vtt_key: z.string().nullable(),
  snapshot_index_key: z.string().nullable(),
  timeline_key: z.string().nullable(),
  enriched_timeline_key: z.string().nullable(),
  audio_media_key: z.string().nullable(),
  screen_media_key: z.string().nullable(),
  signals_key: z.string().nullable(),
  summary: z.string().nullable(),
  analysis_summary: z.string().nullable(),
  signal_count: z.number(),
  talk_ratio: z.number().nullable(),
  quality_score: z.number().nullable(),
  consent_recording: z.number(),
  consent_analytics: z.number(),
  consent_followup: z.number(),
  cost_audio_cents: z.number(),
  cost_transcription_cents: z.number(),
  cost_analysis_cents: z.number(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  interview_state: ApiInterviewStateSchema.optional(),
});
export type ApiSession = z.infer<typeof ApiSessionSchema>;

export const ApiSessionMessageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.string(),
  content: z.string(),
  timestamp_ms: z.number(),
  sentiment: z.number().nullable(),
  audio_chunk_key: z.string().nullable(),
  idempotency_key: z.string().nullable(),
  created_at: z.string(),
  transcript_source: z.enum(['offline', 'realtime', 'legacy']).optional(),
  transcript_timing_source: z.enum(['capture_relative', 'sequence_fallback', 'media_relative', 'provider_result']).optional(),
  capture_start_ms: z.number().nullable().optional(),
  capture_end_ms: z.number().nullable().optional(),
  provider_result_at_ms: z.number().nullable().optional(),
});
export type ApiSessionMessage = z.infer<typeof ApiSessionMessageSchema>;

export const ApiSessionEventSchema = z.object({
  event_type: z.string(),
  timestamp_ms: z.number(),
  event_line: z.string().nullable().optional(),
  data_json: z.string().optional(),
});
export type ApiSessionEvent = z.infer<typeof ApiSessionEventSchema>;

export const ApiAudioChunkSchema = z.object({
  id: z.number(),
  session_id: z.string(),
  chunk_index: z.number(),
  r2_key: z.string(),
  duration_ms: z.number().nullable(),
  size_bytes: z.number().nullable(),
  mime_type: z.string(),
  transcribed: z.number(),
  transcript_text: z.string().nullable(),
  created_at: z.string(),
  recorded_at_ms: z.number().int().nonnegative().optional(),
  source_sequence: z.number().int().nonnegative().optional(),
  discontinuity_before: z.boolean().optional(),
  timing_source: z.enum(['capture_relative', 'sequence_fallback']).optional(),
});
export type ApiAudioChunk = z.infer<typeof ApiAudioChunkSchema>;

export const ApiScreenChunkEntrySchema = z.object({
  index: z.number(),
  r2_key: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  recorded_at_ms: z.number(),
  duration_ms: z.number().int().positive().optional(),
  source_sequence: z.number().int().nonnegative().optional(),
  discontinuity_before: z.boolean().optional(),
  timing_source: z.enum(['capture_relative', 'sequence_fallback']).optional(),
});
export type ApiScreenChunkEntry = z.infer<typeof ApiScreenChunkEntrySchema>;

export const ApiScreenManifestSchema = z.object({
  session_id: z.string(),
  version: z.number(),
  container: z.string(),
  default_mime: z.string(),
  chunk_duration_ms_target: z.number(),
  chunks: z.array(ApiScreenChunkEntrySchema),
  finalized: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiScreenManifest = z.infer<typeof ApiScreenManifestSchema>;

export const ApiSessionCueSchema = z.object({
  id: z.string(),
  start_ms: z.number(),
  end_ms: z.number().nullable().optional(),
  text: z.string(),
  speaker: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  snapshot_token: z.string().nullable().optional(),
});
export type ApiSessionCue = z.infer<typeof ApiSessionCueSchema>;

// Preview content surfaced inline on the sessions list so each row reads
// like the awesome session detail page in miniature — top extracted insight
// + signal-type breakdown, instead of just participant + duration.
export const ApiSessionPreviewSchema = z.object({
  top_signal: z.object({
    id: z.string(),
    signal_type: z.string(),
    headline: z.string().nullable(),
    quote: z.string(),
    intensity: z.number().nullable(),
  }).nullable(),
  breakdown: z.record(z.string(), z.number()),
});
export type ApiSessionPreview = z.infer<typeof ApiSessionPreviewSchema>;

export const ApiSessionListItemSchema = ApiSessionSchema.extend({
  preview: ApiSessionPreviewSchema.nullable(),
});
export type ApiSessionListItem = z.infer<typeof ApiSessionListItemSchema>;

export const ApiSessionsListResponseSchema = z.object({
  sessions: z.array(ApiSessionListItemSchema),
  total: z.number(),
});
export type ApiSessionsListResponse = z.infer<typeof ApiSessionsListResponseSchema>;

export const ApiSessionDetailResponseSchema = z.object({
  session: ApiSessionSchema,
  messages: z.array(ApiSessionMessageSchema),
  events: z.array(ApiSessionEventSchema),
  audioChunks: z.array(ApiAudioChunkSchema),
  screenManifest: ApiScreenManifestSchema.nullable(),
  artifacts: z.object({
    transcript_key: z.string().nullable(),
    voice_vtt_key: z.string().nullable(),
    actions_vtt_key: z.string().nullable(),
    session_vtt_key: z.string().nullable(),
    snapshot_index_key: z.string().nullable(),
  }).optional(),
});
export type ApiSessionDetailResponse = z.infer<typeof ApiSessionDetailResponseSchema>;

export const ApiSessionMutationResponseSchema = z.object({
  session: ApiSessionSchema,
}).meta({ id: 'ApiSessionMutationResponse' });
export type ApiSessionMutationResponse = z.infer<typeof ApiSessionMutationResponseSchema>;

export const ApiSessionUploadVideoResponseSchema = z.object({
  session: ApiSessionSchema,
  queued: z.boolean(),
}).meta({ id: 'ApiSessionUploadVideoResponse' });
export type ApiSessionUploadVideoResponse = z.infer<typeof ApiSessionUploadVideoResponseSchema>;

export const ApiMediaUploadInitiateResponseSchema = z.object({
  session: ApiSessionSchema,
  upload: z.object({
    uploadId: z.string(),
    partSizeBytes: z.number().int().positive(),
    partCount: z.number().int().positive(),
  }),
}).meta({ id: 'ApiMediaUploadInitiateResponse' });
export type ApiMediaUploadInitiateResponse = z.infer<typeof ApiMediaUploadInitiateResponseSchema>;

export const ApiMediaUploadPartUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
}).meta({ id: 'ApiMediaUploadPartUrlResponse' });
export type ApiMediaUploadPartUrlResponse = z.infer<typeof ApiMediaUploadPartUrlResponseSchema>;

export const ApiSessionMessageResponseSchema = z.object({
  message: ApiSessionMessageSchema,
});
export type ApiSessionMessageResponse = z.infer<typeof ApiSessionMessageResponseSchema>;

export const ApiSessionCuesResponseSchema = z.object({
  cues: z.array(ApiSessionCueSchema),
});
export type ApiSessionCuesResponse = z.infer<typeof ApiSessionCuesResponseSchema>;

export const ApiProcessingTraceEntrySchema = z.object({
  step: z.string(),
  status: z.enum(['started', 'succeeded', 'failed']),
  at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  failed_at: z.string().optional(),
  duration_ms: z.number().optional(),
  code: z.string().optional(),
  retryable: z.boolean().optional(),
  message: z.string().optional(),
  action: z.string().optional(),
  counts: z.record(z.string(), z.union([z.number(), z.boolean(), z.string(), z.null()])).optional(),
});
export type ApiProcessingTraceEntry = z.infer<typeof ApiProcessingTraceEntrySchema>;

export const ApiProcessingStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'processed', 'failed']),
  transcription: z.object({ total: z.number(), completed: z.number() }),
  signals: z.number(),
  tasks_suggested: z.number(),
  error: z.string().optional(),
  error_code: z.string().optional(),
  error_action: z.string().optional(),
  retryable: z.boolean().optional(),
  current_step: z.string().optional(),
  last_step_status: z.enum(['started', 'succeeded', 'failed']).optional(),
  last_step_duration_ms: z.number().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  trace: z.array(ApiProcessingTraceEntrySchema).optional(),
});
export type ApiProcessingStatus = z.infer<typeof ApiProcessingStatusSchema>;

export const ApiBatchProcessingStatusResponseSchema = z.object({
  sessions: z.array(ApiProcessingStatusSchema.extend({ session_id: z.string() })),
  summary: z.object({
    total: z.number(),
    pending: z.number(),
    processing: z.number(),
    processed: z.number(),
    failed: z.number(),
    not_found: z.number(),
  }),
});
export type ApiBatchProcessingStatusResponse = z.infer<typeof ApiBatchProcessingStatusResponseSchema>;

export const ApiSessionReprocessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  transcriptionQueued: z.number(),
});
export type ApiSessionReprocessResponse = z.infer<typeof ApiSessionReprocessResponseSchema>;

export const ApiSessionRetryTranscriptionResponseSchema = z.object({
  success: z.boolean(),
  queued: z.number(),
});
export type ApiSessionRetryTranscriptionResponse = z.infer<typeof ApiSessionRetryTranscriptionResponseSchema>;

export const ApiSessionRetryFailedTranscriptionResponseSchema = z.object({
  success: z.boolean(),
  candidates: z.number(),
  queued: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    sessionId: z.string(),
    status: z.enum(['queued', 'failed']),
    error: z.string().optional(),
  })),
});
export type ApiSessionRetryFailedTranscriptionResponse = z.infer<typeof ApiSessionRetryFailedTranscriptionResponseSchema>;

export const ApiEnrichedTimelineEntrySchema = z.object({
  ts: z.number(),
  end: z.number().optional(),
  type: z.string(),
  speaker: z.string().optional(),
  content: z.string().optional(),
  annotations: z.object({
    pace_wpm: z.number().optional(),
    pace_label: z.string().optional(),
    hesitation: z.boolean().optional(),
    filler_words: z.array(z.string()).optional(),
    pause_duration_ms: z.number().optional(),
  }).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ApiEnrichedTimelineEntry = z.infer<typeof ApiEnrichedTimelineEntrySchema>;
