export type ProcessingStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface ProcessingEvent {
  event_type: string;
  timestamp_ms: number;
  data_json?: string;
}

export type SessionProcessingStatusFilter = 'failed' | 'done';

const PROCESSING_STATUS_FILTERS: Set<SessionProcessingStatusFilter> = new Set(['failed', 'done']);

export function normalizeSessionProcessingFilter(status?: string): SessionProcessingStatusFilter | null {
  if (!status) return null;
  if (PROCESSING_STATUS_FILTERS.has(status as SessionProcessingStatusFilter)) {
    return status as SessionProcessingStatusFilter;
  }
  if (status === 'processed') return 'done';
  return null;
}

// Event types that drive `deriveProcessingStatus`. Exported so callers that
// only need processing status (e.g. the dashboard review-state counts) can
// fetch just these rows instead of every session event — one source of truth,
// so the DB-side filter can never drift from the logic below.
export const PROCESSED_EVENT_TYPES = ['session.processed'] as const;
export const PROCESSING_FAILURE_EVENT_TYPES = [
  'session.processing_failed',
  'session.extraction_failed',
  'session.audio_transcription_failed',
  'session.media_ingest_failed',
  'session.processing_step_failed',
] as const;
export const PROCESSING_RECOVERY_EVENT_TYPES = [
  'session.reprocess_claimed',
  'session.reprocess_requested',
  'session.processing_started',
  'session.processing_step_started',
  'session.processing_step_succeeded',
  'session.audio_transcription_started',
  'session.audio_transcribed',
  'session.media_ingest_queued',
] as const;
export const PROCESSING_STATUS_EVENT_TYPES: readonly string[] = [
  ...PROCESSED_EVENT_TYPES,
  ...PROCESSING_FAILURE_EVENT_TYPES,
  ...PROCESSING_RECOVERY_EVENT_TYPES,
];

export function deriveProcessingStatus(events: ProcessingEvent[]): ProcessingStatus {
  const processedEvent = latestEvent(events, [...PROCESSED_EVENT_TYPES]);
  const latestGenerationTs = maxTimestamp(events, [
    'session.reprocess_claimed',
    'session.reprocess_requested',
    'session.processing_started',
  ]);
  const latestRecoveryTs = maxTimestamp(events, [...PROCESSING_RECOVERY_EVENT_TYPES]);
  // A retry claim/request starts a new processing generation before old replay
  // blockers are deleted. Later step telemetry belongs to the same generation
  // and must not supersede its final processed marker.
  if (processedEvent && (latestGenerationTs === undefined || processedEvent.timestamp_ms >= latestGenerationTs)) {
    const status = readProcessedStatus(processedEvent);
    if (status === 'extraction_failed') return 'failed';
    return 'processed';
  }

  const latestFailureTs = maxTimestamp(events, [...PROCESSING_FAILURE_EVENT_TYPES]);

  if (latestFailureTs !== undefined) {
    if (latestRecoveryTs !== undefined && latestRecoveryTs > latestFailureTs) return 'processing';
    return 'failed';
  }
  if (latestRecoveryTs !== undefined) return 'processing';
  return 'pending';
}

export interface DerivedProcessingDetails {
  status: ProcessingStatus;
  error?: string;
  error_code?: string;
  error_action?: string;
  retryable?: boolean;
  started_at?: string;
  completed_at?: string;
  tasks_suggested: number;
  current_step?: string;
  last_step_status?: 'started' | 'succeeded' | 'failed';
  last_step_duration_ms?: number;
  trace: ProcessingTraceEntry[];
  push_failures?: Array<{ provider?: string; reason?: string }>;
}

export interface ProcessingTraceEntry {
  step: string;
  status: 'started' | 'succeeded' | 'failed';
  at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  duration_ms?: number;
  code?: string;
  retryable?: boolean;
  message?: string;
  action?: string;
  counts?: Record<string, number | boolean | string | null>;
}

export function deriveProcessingDetails(events: ProcessingEvent[]): DerivedProcessingDetails {
  const status = deriveProcessingStatus(events);
  const trace = deriveProcessingTrace(events);
  let error: string | undefined;
  let errorCode: string | undefined;
  let errorAction: string | undefined;
  let retryable: boolean | undefined;
  let startedAt: string | undefined;
  let completedAt: string | undefined;
  let tasksSuggested = 0;
  let currentStep: string | undefined;
  let lastStepStatus: 'started' | 'succeeded' | 'failed' | undefined;
  let lastStepDuration: number | undefined;

  const startedEvent = latestEvent(events, ['session.processing_started']);
  if (startedEvent) startedAt = new Date(startedEvent.timestamp_ms).toISOString();

  const stepEvent = latestEvent(events, [
    'session.processing_step_started',
    'session.processing_step_succeeded',
    'session.processing_step_failed',
  ]);
  if (stepEvent) {
    try {
      const data = JSON.parse(stepEvent.data_json ?? '{}') as Record<string, unknown>;
      if (typeof data.step === 'string') currentStep = data.step;
      if (typeof data.duration_ms === 'number') lastStepDuration = data.duration_ms;
      if (stepEvent.event_type === 'session.processing_step_started') lastStepStatus = 'started';
      if (stepEvent.event_type === 'session.processing_step_succeeded') lastStepStatus = 'succeeded';
      if (stepEvent.event_type === 'session.processing_step_failed') lastStepStatus = 'failed';
    } catch {
      // ignore malformed step telemetry
    }
  }

  if (status === 'processed') {
    const ev = latestEvent(events, ['session.processed']);
    if (ev) {
      completedAt = new Date(ev.timestamp_ms).toISOString();
      try {
        const data = JSON.parse(ev.data_json ?? '{}') as Record<string, unknown>;
        if (typeof data.task_count === 'number') tasksSuggested = data.task_count;
        else if (typeof data.tasks_suggested === 'number') tasksSuggested = data.tasks_suggested;
      } catch { /* ignore */ }
    }
  } else if (status === 'failed') {
    const failures = events.filter(e =>
      e.event_type === 'session.audio_transcription_failed'
      || e.event_type === 'session.processing_failed'
      || e.event_type === 'session.extraction_failed'
      || e.event_type === 'session.media_ingest_failed'
      || e.event_type === 'session.processing_step_failed'
    );
    let ev: typeof failures[number] | undefined;
    for (const candidate of failures) {
      if (!ev || candidate.timestamp_ms > ev.timestamp_ms) ev = candidate;
    }
    if (!ev) {
      error = 'Processing failed';
    } else {
      try {
        const data = JSON.parse(ev.data_json ?? '{}') as Record<string, unknown>;
        const reason = typeof data.reason === 'string' ? data.reason : undefined;
        error = (data.error as string) || reason || 'Processing failed';
        if (reason && error && !error.includes(reason)) {
          error = `${error} Reason: ${reason}`;
        }
        errorCode = typeof data.code === 'string' ? data.code : undefined;
        errorAction = typeof data.action === 'string' ? data.action : undefined;
        retryable = typeof data.retryable === 'boolean' ? data.retryable : undefined;
        if (ev.event_type === 'session.audio_transcription_failed') {
          error = (data.message as string) || error || 'Audio transcription failed';
        }
        if (ev.event_type === 'session.processing_step_failed') {
          error = (data.message as string) || error || 'Processing failed';
        }
      } catch {
        error = 'Processing failed';
      }
    }
  }

  const pushFailureEvents = events.filter(e => e.event_type === 'session.autopush_failed');
  const pushFailures: Array<{ provider?: string; reason?: string }> = pushFailureEvents.map(e => {
    try {
      const data = JSON.parse(e.data_json ?? '{}') as Record<string, unknown>;
      return {
        ...(typeof data.provider === 'string' ? { provider: data.provider } : {}),
        ...(typeof data.reason === 'string' ? { reason: data.reason } : {}),
      };
    } catch {
      return {};
    }
  });

  return {
    status,
    error,
    ...(errorCode ? { error_code: errorCode } : {}),
    ...(errorAction ? { error_action: errorAction } : {}),
    ...(retryable !== undefined ? { retryable } : {}),
    started_at: startedAt,
    completed_at: completedAt,
    tasks_suggested: tasksSuggested,
    ...(currentStep ? { current_step: currentStep } : {}),
    ...(lastStepStatus ? { last_step_status: lastStepStatus } : {}),
    ...(lastStepDuration !== undefined ? { last_step_duration_ms: lastStepDuration } : {}),
    trace,
    ...(pushFailures.length > 0 ? { push_failures: pushFailures } : {}),
  };
}

function deriveProcessingTrace(events: ProcessingEvent[]): ProcessingTraceEntry[] {
  const stepEventTypes = new Set([
    'session.processing_step_started',
    'session.processing_step_succeeded',
    'session.processing_step_failed',
  ]);

  return events
    .filter((event) => stepEventTypes.has(event.event_type))
    .toSorted((a, b) => a.timestamp_ms - b.timestamp_ms)
    .flatMap((event) => {
      const data = parseEventData(event.data_json);
      const step = typeof data.step === 'string' ? data.step : null;
      if (!step) return [];

      const entry: ProcessingTraceEntry = {
        step,
        status: processingStepStatus(event.event_type),
        at: new Date(event.timestamp_ms).toISOString(),
      };

      if (typeof data.started_at === 'string') entry.started_at = data.started_at;
      if (typeof data.completed_at === 'string') entry.completed_at = data.completed_at;
      if (typeof data.failed_at === 'string') entry.failed_at = data.failed_at;
      if (typeof data.duration_ms === 'number') entry.duration_ms = data.duration_ms;
      if (typeof data.code === 'string') entry.code = data.code;
      if (typeof data.retryable === 'boolean') entry.retryable = data.retryable;
      if (typeof data.message === 'string') entry.message = data.message;
      if (typeof data.action === 'string') entry.action = data.action;
      if (isProcessingCounts(data.counts)) entry.counts = data.counts;

      return [entry];
    });
}

function processingStepStatus(eventType: string): ProcessingTraceEntry['status'] {
  if (eventType === 'session.processing_step_succeeded') return 'succeeded';
  if (eventType === 'session.processing_step_failed') return 'failed';
  return 'started';
}

function parseEventData(dataJson?: string): Record<string, unknown> {
  if (!dataJson) return {};
  try {
    const parsed = JSON.parse(dataJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function isProcessingCounts(value: unknown): value is Record<string, number | boolean | string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) =>
    entry === null
    || typeof entry === 'number'
    || typeof entry === 'boolean'
    || typeof entry === 'string',
  );
}

function maxTimestamp(events: ProcessingEvent[], eventTypes: string[]): number | undefined {
  let max: number | undefined;
  for (const event of events) {
    if (!eventTypes.includes(event.event_type)) continue;
    if (max === undefined || event.timestamp_ms > max) {
      max = event.timestamp_ms;
    }
  }
  return max;
}

function latestEvent(events: ProcessingEvent[], eventTypes: string[]): ProcessingEvent | undefined {
  let current: ProcessingEvent | undefined;
  for (const event of events) {
    if (!eventTypes.includes(event.event_type)) continue;
    if (!current || event.timestamp_ms > current.timestamp_ms) {
      current = event;
    }
  }
  return current;
}

const STEP_LABELS: Record<string, string> = {
  'claim-session': 'Session claim',
  'fetch-session-data': 'Session data fetch',
  'fetch-context': 'Context fetch',
  'build-transcript': 'Transcript build',
  'merge-media': 'Media merge',
  'merge-audio': 'Audio merge',
  'merge-screen': 'Screen merge',
  'extract-signals': 'Signal extraction',
  'candidate-sweep': 'Evidence candidate search',
  'candidate-resolution': 'Evidence candidate review',
  'refinement': 'Evidence refinement',
  'evidence-storage': 'Evidence storage',
  'suggest-tasks': 'Work grouping',
  'finalize': 'Finalization',
};

const STEP_PROGRESS_LABELS: Record<string, string> = {
  'build-transcript': 'Transcribing audio...',
  'merge-audio': 'Merging audio...',
  'merge-screen': 'Merging screen recording...',
  'merge-media': 'Merging media...',
  'extract-signals': 'Extracting signals...',
  'candidate-sweep': 'Finding evidence candidates...',
  'candidate-resolution': 'Resolving evidence candidates...',
  'refinement': 'Refining evidence...',
  'evidence-storage': 'Saving evidence...',
  'suggest-tasks': 'Grouping work...',
  'finalize': 'Finalizing...',
  'fetch-session-data': 'Loading session data...',
  'fetch-context': 'Loading context...',
  'claim-session': 'Claiming session...',
};

/** Human-readable noun label for a processing step (e.g. "Signal extraction"). */
export function formatStepLabel(step: string): string {
  return STEP_LABELS[step] || step;
}

/** Human-readable progress label for a processing step (e.g. "Extracting signals..."). */
export function formatProcessingLabel(
  status: { current_step?: string; transcription: { total: number; completed: number } } | null,
): string {
  if (!status) return 'Processing session...';
  if (status.current_step) {
    return STEP_PROGRESS_LABELS[status.current_step] || 'Processing session...';
  }
  if (status.transcription.total > 0) {
    return `Transcribing audio (${status.transcription.completed}/${status.transcription.total})...`;
  }
  return 'Processing session...';
}

function readProcessedStatus(event: ProcessingEvent): string | undefined {
  try {
    const data = JSON.parse(event.data_json ?? '{}') as Record<string, unknown>;
    return typeof data.status === 'string' ? data.status : undefined;
  } catch {
    return undefined;
  }
}
