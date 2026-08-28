import type { SessionStatus } from './constants';
import type { ProcessingStatus } from './processing-status';

export const CAPTURE_STATES = ['not_started', 'in_progress', 'completed', 'ended_early', 'interrupted', 'connection_warning'] as const;
export type CaptureState = typeof CAPTURE_STATES[number];

export const RESULTS_STATES = ['not_applicable', 'pending', 'processing', 'ready', 'failed'] as const;
export type ResultsState = typeof RESULTS_STATES[number];

export const REVIEW_STATES = ['in_progress', 'processing', 'ready_for_review', 'completed_no_evidence', 'needs_attention', 'ended_early'] as const;
export type ReviewState = typeof REVIEW_STATES[number];

export const INTERVIEW_STATE_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;
export type InterviewStateTone = typeof INTERVIEW_STATE_TONES[number];

export const PRIMARY_INTERVIEW_ACTIONS = ['open', 'wait', 'review', 'retry', 'inspect'] as const;
export type PrimaryInterviewAction = typeof PRIMARY_INTERVIEW_ACTIONS[number];

export interface InterviewStateInput {
  status: SessionStatus;
  completed_at?: string | null;
  signal_count?: number | null;
  summary?: string | null;
  transcript_key?: string | null;
  timeline_key?: string | null;
  enriched_timeline_key?: string | null;
  voice_vtt_key?: string | null;
  actions_vtt_key?: string | null;
  session_vtt_key?: string | null;
  snapshot_index_key?: string | null;
  audio_media_key?: string | null;
  screen_media_key?: string | null;
  signals_key?: string | null;
}

export interface InterviewState {
  capture_state: CaptureState;
  results_state: ResultsState;
  review_state: ReviewState;
  label: string;
  tone: InterviewStateTone;
  primary_action: PrimaryInterviewAction;
}

export function deriveInterviewState(
  session: InterviewStateInput,
  processingStatus?: ProcessingStatus | null,
): InterviewState {
  const captureState = deriveCaptureState(session);
  const resultsState = deriveResultsState(session, captureState, processingStatus);
  const reviewState = deriveReviewState(session, captureState, resultsState);
  return describeReviewState(reviewState, captureState, resultsState);
}

function deriveCaptureState(session: InterviewStateInput): CaptureState {
  switch (session.status) {
    case 'pending':
      return 'not_started';
    case 'active':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'abandoned':
      return 'ended_early';
    case 'error':
      return session.completed_at ? 'connection_warning' : 'interrupted';
  }
}

function deriveResultsState(
  session: InterviewStateInput,
  captureState: CaptureState,
  processingStatus?: ProcessingStatus | null,
): ResultsState {
  if (captureState === 'not_started' || captureState === 'in_progress' || captureState === 'ended_early') {
    return 'not_applicable';
  }

  if (processingStatus === 'failed' || session.signal_count === -1) return 'failed';
  if (processingStatus === 'processed') return 'ready';
  if (processingStatus === 'processing') return 'processing';
  if (processingStatus === 'pending') return hasResultArtifacts(session) ? 'ready' : 'pending';

  if (hasResultArtifacts(session)) return 'ready';
  if (captureState === 'interrupted') return 'failed';
  return 'pending';
}

function deriveReviewState(
  session: InterviewStateInput,
  captureState: CaptureState,
  resultsState: ResultsState,
): ReviewState {
  if (captureState === 'not_started' || captureState === 'in_progress') return 'in_progress';
  if (captureState === 'ended_early') return 'ended_early';
  if (captureState === 'interrupted' || resultsState === 'failed') return 'needs_attention';
  if (resultsState === 'pending' || resultsState === 'processing') return 'processing';
  if (resultsState === 'ready' && (session.signal_count ?? 0) > 0) return 'ready_for_review';
  return 'completed_no_evidence';
}

function describeReviewState(
  reviewState: ReviewState,
  captureState: CaptureState,
  resultsState: ResultsState,
): InterviewState {
  switch (reviewState) {
    case 'in_progress':
      return {
        capture_state: captureState,
        results_state: resultsState,
        review_state: reviewState,
        label: 'In progress',
        tone: 'info',
        primary_action: 'open',
      };
    case 'processing':
      return {
        capture_state: captureState,
        results_state: resultsState,
        review_state: reviewState,
        label: 'Processing',
        tone: 'info',
        primary_action: 'wait',
      };
    case 'ready_for_review':
      return {
        capture_state: captureState,
        results_state: resultsState,
        review_state: reviewState,
        label: 'Ready for review',
        tone: 'success',
        primary_action: 'review',
      };
    case 'completed_no_evidence':
      return {
        capture_state: captureState,
        results_state: resultsState,
        review_state: reviewState,
        label: 'Completed, no evidence',
        tone: 'neutral',
        primary_action: 'inspect',
      };
    case 'needs_attention':
      return {
        capture_state: captureState,
        results_state: resultsState,
        review_state: reviewState,
        label: 'Needs attention',
        tone: 'danger',
        primary_action: 'retry',
      };
    case 'ended_early':
      return {
        capture_state: captureState,
        results_state: resultsState,
        review_state: reviewState,
        label: 'Ended early',
        tone: 'warning',
        primary_action: 'inspect',
      };
  }
}

function hasResultArtifacts(session: InterviewStateInput): boolean {
  return (session.signal_count ?? 0) > 0
    || Boolean(session.summary)
    || Boolean(session.signals_key);
}
