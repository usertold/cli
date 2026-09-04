import { open, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { ParsedArgs } from '../lib/types';
import {
  assertNoExtraPositionals,
  getBooleanOption,
  hasHelpFlag,
  parseEnvironment,
  requireOption,
} from '../lib/args';

import { fail } from '../lib/errors';
import {
  requestProjectContractBinary,
  requestProjectContractFormDataJson,
  requestProjectContractJson,
  requestProjectContractText,
} from '../lib/contract-api';
import { isJsonOutput, printOutput, remapVocabTopLevelKeys } from '../lib/output';
import { resolveBaseUrl } from '../lib/config';
import { buildProjectApiPathFromRef } from '../lib/project-ref';
import { consumeProjectRef } from '../lib/project-defaults';
import type { ApiProcessingStatus, ApiSessionDetailResponse, ApiSessionEvent } from '../../shared/api-types';
import { normalizeSessionProcessingFilter } from '../../shared/processing-status';
import { printCommandHelp } from './help-manifest';
import {
  validateCustomAudioUploadMetadata,
  validateCustomPlaybackVideoUploadMetadata,
} from '../../shared/custom-video-upload';
import {
  getImportedMediaKind,
  MAX_IMPORTED_MEDIA_BYTES,
} from '../../shared/media-processing-contract';

function projectApi(projectRef: string): string {
  return buildProjectApiPathFromRef(projectRef, '', '<projectRef>');
}

function inferRecordingContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.aac':
      return 'audio/aac';
    case '.flac':
      return 'audio/flac';
    case '.m4a':
      return 'audio/x-m4a';
    case '.mp3':
      return 'audio/mpeg';
    case '.ogg':
    case '.opus':
      return 'audio/ogg';
    case '.wav':
      return 'audio/wav';
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    case '.mpeg':
    case '.mpg':
      return 'video/mpeg';
    default:
      return 'application/octet-stream';
  }
}

function readUploadContentTypeOption(parsed: ParsedArgs, optionName: string): string | undefined {
  const value = parsed.options[optionName];
  return value && value !== 'true' ? value : undefined;
}

function requireUploadOption(parsed: ParsedArgs, optionName: string): string {
  const value = parsed.options[optionName];
  if (!value || value === 'true') {
    fail(`Missing required option: --${optionName}`);
  }
  return value;
}

const MULTIPART_UPLOAD_RETRY_DELAYS_MS = [500, 1_500, 4_000] as const;

async function appendUploadFile(
  formData: FormData,
  input: {
    fieldName: 'media' | 'audio' | 'video';
    filePath: string;
    contentType: string;
    expectedLabel: 'recording' | 'audio' | 'video';
  },
): Promise<void> {
  let fileInfo: Awaited<ReturnType<typeof stat>>;
  try {
    fileInfo = await stat(input.filePath);
  } catch (error) {
    fail(`Cannot read ${input.expectedLabel} file "${input.filePath}": ${(error as Error).message}`);
  }
  if (!fileInfo.isFile()) {
    fail(`${capitalize(input.expectedLabel)} path must be a file: ${input.filePath}`);
  }

  const validationError = input.expectedLabel === 'audio'
    ? validateCustomAudioUploadMetadata({ sizeBytes: fileInfo.size, contentType: input.contentType })
    : validateCustomPlaybackVideoUploadMetadata({ sizeBytes: fileInfo.size, contentType: input.contentType });
  if (validationError) {
    fail(validationError);
  }

  const buffer = await readFile(input.filePath);
  formData.set(input.fieldName, new Blob([buffer], { type: input.contentType }), basename(input.filePath));
}

async function uploadMediaMultipartFromFile(input: {
  env: ReturnType<typeof parseEnvironment>;
  projectRef: string;
  filePath: string;
  contentType: string;
  participantName?: string;
  participantEmail?: string;
  studyRef?: string;
}): Promise<unknown> {
  let fileInfo: Awaited<ReturnType<typeof stat>>;
  try {
    fileInfo = await stat(input.filePath);
  } catch (error) {
    fail(`Cannot read recording file "${input.filePath}": ${(error as Error).message}`);
  }
  if (!fileInfo.isFile()) {
    fail(`Recording path must be a file: ${input.filePath}`);
  }
  if (!getImportedMediaKind(input.contentType)) {
    fail('Upload a supported audio or video file: mp3, m4a, wav, ogg, flac, aac, mp4, mov, webm, or mpeg');
  }
  if (fileInfo.size <= 0) fail('Recording file is empty');
  if (fileInfo.size > MAX_IMPORTED_MEDIA_BYTES) {
    fail('Recording exceeds the 20GB import limit');
  }

  const initiated = await requestProjectContractJson('mediaUploadInitiate', {
    env: input.env,
    projectRef: input.projectRef,
    body: {
      filename: basename(input.filePath),
      contentType: input.contentType,
      sizeBytes: fileInfo.size,
      ...(input.participantName ? { participantName: input.participantName } : {}),
      ...(input.participantEmail ? { participantEmail: input.participantEmail } : {}),
      ...(input.studyRef ? { studyRef: input.studyRef } : {}),
    },
  });
  const parts: Array<{ partNumber: number; etag: string }> = [];
  const handle = await open(input.filePath, 'r');
  try {
    for (let partNumber = 1; partNumber <= initiated.upload.partCount; partNumber++) {
      const offset = (partNumber - 1) * initiated.upload.partSizeBytes;
      const length = Math.min(initiated.upload.partSizeBytes, fileInfo.size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead !== length) {
        throw new Error(`Expected ${length} bytes for upload part ${partNumber}, read ${bytesRead}`);
      }
      const etag = await uploadMultipartFilePart({
        ...input,
        sessionId: initiated.session.id,
        uploadId: initiated.upload.uploadId,
        partNumber,
        buffer,
      });
      parts.push({
        partNumber,
        etag: etag.replace(/^W\//, '').replace(/^"|"$/g, ''),
      });
    }
  } finally {
    await handle.close();
  }

  return requestProjectContractJson('mediaUploadComplete', {
    env: input.env,
    projectRef: input.projectRef,
    pathParams: { sessionId: initiated.session.id },
    body: { uploadId: initiated.upload.uploadId, parts },
  });
}

async function uploadMultipartFilePart(input: {
  env: ReturnType<typeof parseEnvironment>;
  projectRef: string;
  sessionId: string;
  uploadId: string;
  partNumber: number;
  contentType: string;
  buffer: Buffer<ArrayBuffer>;
}): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MULTIPART_UPLOAD_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { url } = await requestProjectContractJson('mediaUploadPartUrl', {
        env: input.env,
        projectRef: input.projectRef,
        pathParams: { sessionId: input.sessionId },
        body: { uploadId: input.uploadId, partNumber: input.partNumber },
      });
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': input.contentType },
        body: input.buffer,
      });
      if (!response.ok) {
        throw new Error(`R2 upload part ${input.partNumber} failed with HTTP ${response.status}`);
      }
      const etag = response.headers.get('ETag');
      if (!etag) throw new Error('R2 upload response did not include ETag');
      return etag;
    } catch (error) {
      lastError = error;
      const delay = MULTIPART_UPLOAD_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await sleep(delay);
    }
  }
  throw lastError;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatRelativeTime(timestampMs: number, startMs: number): string {
  const relMs = Math.max(0, timestampMs - startMs);
  const mins = Math.floor(relMs / 60000);
  const secs = Math.floor((relMs % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseEventData(event: ApiSessionEvent): Record<string, unknown> {
  if (!event.data_json) return {};
  try {
    return JSON.parse(event.data_json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function summarizeEventData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'object') continue;
    parts.push(`${key}=${val}`);
  }
  return parts.join(' ');
}

function hasChunkBackedScreenMedia(
  detail: Pick<ApiSessionDetailResponse, 'session' | 'screenManifest'>,
): boolean {
  return Boolean(detail.session.screen_media_key) || (detail.screenManifest?.chunks.length ?? 0) > 0;
}

function hasChunkBackedAudioMedia(
  detail: Pick<ApiSessionDetailResponse, 'session' | 'audioChunks'>,
): boolean {
  return Boolean(detail.session.audio_media_key) || detail.audioChunks.length > 0;
}

type MediaAvailability = {
  available: boolean;
  merged: boolean;
  chunk_backed: boolean;
  source: 'none' | 'merged' | 'chunk-backed' | 'merged+chunk-backed';
};

function describeMediaAvailability(opts: { merged: boolean; chunkBacked: boolean }): MediaAvailability {
  const { merged, chunkBacked } = opts;

  if (merged && chunkBacked) {
    return {
      available: true,
      merged: true,
      chunk_backed: true,
      source: 'merged+chunk-backed',
    };
  }

  if (merged) {
    return {
      available: true,
      merged: true,
      chunk_backed: false,
      source: 'merged',
    };
  }

  if (chunkBacked) {
    return {
      available: true,
      merged: false,
      chunk_backed: true,
      source: 'chunk-backed',
    };
  }

  return {
    available: false,
    merged: false,
    chunk_backed: false,
    source: 'none',
  };
}

function formatMediaAvailability(availability: MediaAvailability, url: string): string {
  if (!availability.available) return 'not available';
  if (availability.source === 'merged') return `${url} (merged)`;
  if (availability.source === 'chunk-backed') return `${url} (chunk-backed)`;
  return `${url} (merged + chunk-backed)`;
}

function fetchSessionDetail(env: string, projectId: string, sessionId: string): Promise<ApiSessionDetailResponse> {
  return requestProjectContractJson('sessionGet', {
    env: env as 'stage' | 'production' | 'local',
    projectRef: projectId,
    pathParams: { sessionId },
  });
}

function fetchProcessingStatus(env: string, projectId: string, sessionId: string): Promise<ApiProcessingStatus> {
  return requestProjectContractJson('sessionGetProcessing', {
    env: env as 'stage' | 'production' | 'local',
    projectRef: projectId,
    pathParams: { sessionId },
  });
}

const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

async function pollUntilDone(opts: {
  env: string;
  projectId: string;
  sessionId: string;
  intervalMs: number;
  timeoutMs: number;
  json: boolean;
  verbose?: boolean;
  signals?: boolean;
}): Promise<void> {
  const startedAt = performance.now();
  let frame = 0;
  let lastEventCount = 0;
  let lastSignalCount = 0;

  while (true) {
    const status = await fetchProcessingStatus(opts.env, opts.projectId, opts.sessionId);

    if (opts.json) {
      // Re-key the API's top-level nouns to the CLI surface vocabulary.
      const { signals, tasks_suggested, ...restStatus } = status;
      console.log(JSON.stringify({ ...restStatus, evidence: signals, findings_suggested: tasks_suggested }));
    } else {
      const spinner = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
      frame++;
      const { total, completed } = status.transcription;
      const parts: string[] = [status.status];
      if (total > 0) parts.push(`transcription: ${completed}/${total}`);
      if (status.signals > 0) parts.push(`evidence: ${status.signals}`);
      if (status.tasks_suggested > 0) parts.push(`findings: ${status.tasks_suggested}`);
      if (status.error) parts.push(`error: ${status.error}`);
      process.stderr.write(`\r${spinner} ${parts.join(' | ')}\x1B[K`);
    }

    // Verbose: show new events since last poll
    if (opts.verbose && !opts.json) {
      try {
        const detail = await fetchSessionDetail(opts.env, opts.projectId, opts.sessionId);
        const newEvents = detail.events.slice(lastEventCount);
        if (newEvents.length > 0) {
          process.stderr.write('\n');
          const startMs = detail.session.started_at
            ? new Date(detail.session.started_at).getTime()
            : (detail.events.length > 0 ? detail.events[0].timestamp_ms : 0);
          for (const event of newEvents) {
            const time = formatRelativeTime(event.timestamp_ms, startMs);
            const eventData = parseEventData(event);
            const eventDetail = summarizeEventData(eventData);
            process.stderr.write(`  [${time}] ${event.event_type}${eventDetail ? `  ${eventDetail}` : ''}\n`);
          }
          lastEventCount = detail.events.length;
        }
      } catch { /* non-critical */ }
    }

    // Signals: show newly appeared signals
    if (opts.signals && !opts.json) {
      try {
        const signalsData = await requestProjectContractJson('signalsList', {
          env: opts.env as 'stage' | 'production' | 'local',
          projectRef: opts.projectId,
          query: {
            session_id: opts.sessionId,
            dismissed: 'false',
          },
        });
        const allSignals = signalsData.signals || [];
        if (allSignals.length > lastSignalCount) {
          process.stderr.write('\n');
          for (const sig of allSignals.slice(lastSignalCount)) {
            const preview = signalEvidencePreview(sig);
            process.stderr.write(`  [${sig.signal_type}] ${sig.id}: ${preview.label}: ${preview.text.slice(0, 80)}${preview.text.length > 80 ? '...' : ''}\n`);
          }
          lastSignalCount = allSignals.length;
        }
      } catch { /* non-critical */ }
    }

    if (status.status === 'processed' || status.status === 'failed') {
      if (!opts.json) process.stderr.write('\n');
      process.exit(status.status === 'failed' ? 1 : 0);
    }

    // Deadline is enforced *after* the status check so that a terminal state
    // arriving during the final sleep window is still observed. Monotonic
    // clock so wall-clock jumps (NTP, manual time changes) can't shorten or
    // extend the wait.
    if (opts.timeoutMs !== Infinity && performance.now() - startedAt >= opts.timeoutMs) break;
    await sleep(opts.intervalMs);
  }

  if (!opts.json) process.stderr.write('\n');
  process.stderr.write('Timed out waiting for processing to complete.\n');
  process.exit(2);
}

function signalEvidencePreview(signal: {
  quote: string;
  observed_facts_json?: string | null;
  headline?: string | null;
  claim?: string | null;
}): { label: string; text: string } {
  const quote = signal.quote.trim();
  if (quote) return { label: 'Participant quote', text: `"${quote}"` };
  if (signal.observed_facts_json) {
    try {
      const facts = JSON.parse(signal.observed_facts_json) as unknown;
      if (Array.isArray(facts)) {
        const fact = facts.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
        if (fact) return { label: 'Observed behavior', text: fact.trim() };
      }
    } catch { /* malformed observed facts fall through to generated fields */ }
  }
  const headline = signal.headline?.trim();
  if (headline) return { label: 'Generated summary', text: headline };
  const interpretation = signal.claim?.trim();
  if (interpretation) return { label: 'Interpretation', text: interpretation };
  return { label: 'Evidence', text: 'details unavailable' };
}

// ─── Command handler ─────────────────────────────────────────────────────────

export async function handleSessionCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('interview');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'list': {
      const { projectRef: projectId } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'interview list' });

      const params = new URLSearchParams();
      if (parsed.options.status && parsed.options.status !== 'true') {
        params.set('status', parsed.options.status);
      }
      if (parsed.options['processing-status'] && parsed.options['processing-status'] !== 'true') {
        const processingStatus = parsed.options['processing-status'];
        const normalizedStatus = normalizeSessionProcessingFilter(processingStatus);
        if (!normalizedStatus) {
          fail(`Unsupported --processing-status "${processingStatus}". Supported values: failed, done.`);
        }
        params.set('processing_status', normalizedStatus);
      }
      if (parsed.options.study && parsed.options.study !== 'true') {
        params.set('study_ref', parsed.options.study);
      }
      if (parsed.options.limit && parsed.options.limit !== 'true') {
        params.set('limit', parsed.options.limit);
      }
      if (parsed.options.offset && parsed.options.offset !== 'true') {
        params.set('offset', parsed.options.offset);
      }

      const data = await requestProjectContractJson('sessionsList', {
        env,
        projectRef: projectId,
        query: Object.fromEntries(params.entries()),
      });
      printOutput(data, parsed);
      return;
    }

    case 'create': {
      const { projectRef: projectId } = await consumeProjectRef(parsed, env, { resourceArgCount: 0, commandLabel: 'interview create' });

      const body: Record<string, unknown> = {};
      if (parsed.options.name && parsed.options.name !== 'true') {
        body.participant_name = parsed.options.name;
      }
      if (parsed.options.email && parsed.options.email !== 'true') {
        body.participant_email = parsed.options.email;
      }
      if (parsed.options.mode && parsed.options.mode !== 'true') {
        body.interview_mode = parsed.options.mode;
      }

      const data = await requestProjectContractJson('sessionCreate', {
        env,
        projectRef: projectId,
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'upload-video': {
      const usesSeparateMedia = Boolean(parsed.options.audio || parsed.options.video);
      if (parsed.options.video && !parsed.options.audio) {
        fail('--video is only supported together with --audio. For a single video upload, pass the video path as <file>.');
      }
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, {
        resourceArgCount: usesSeparateMedia ? 0 : 1,
        commandLabel: 'interview upload-video',
      });
      if (usesSeparateMedia) {
        const formData = new FormData();
        const audioPath = requireUploadOption(parsed, 'audio');
        await appendUploadFile(formData, {
          fieldName: 'audio',
          filePath: audioPath,
          contentType: readUploadContentTypeOption(parsed, 'audio-content-type') ?? inferRecordingContentType(audioPath),
          expectedLabel: 'audio',
        });
        if (parsed.options.video && parsed.options.video !== 'true') {
          const videoPath = parsed.options.video;
          await appendUploadFile(formData, {
            fieldName: 'video',
            filePath: videoPath,
            contentType: readUploadContentTypeOption(parsed, 'video-content-type') ?? inferRecordingContentType(videoPath),
            expectedLabel: 'video',
          });
        }
        formData.set('upload_source', 'cli');
        if (parsed.options.name && parsed.options.name !== 'true') {
          formData.set('participant_name', parsed.options.name);
        }
        if (parsed.options.email && parsed.options.email !== 'true') {
          formData.set('participant_email', parsed.options.email);
        }
        if (parsed.options.study && parsed.options.study !== 'true') {
          formData.set('study_ref', parsed.options.study);
        }
        const data = await requestProjectContractFormDataJson('sessionUploadVideo', {
          env,
          projectRef: projectId,
          formData,
        });
        printOutput(data, parsed);
        return;
      }

      const filePath = args[0];
      const data = await uploadMediaMultipartFromFile({
        env,
        projectRef: projectId,
        filePath,
        contentType: readUploadContentTypeOption(parsed, 'content-type') ?? inferRecordingContentType(filePath),
        ...(parsed.options.name && parsed.options.name !== 'true' ? { participantName: parsed.options.name } : {}),
        ...(parsed.options.email && parsed.options.email !== 'true' ? { participantEmail: parsed.options.email } : {}),
        ...(parsed.options.study && parsed.options.study !== 'true' ? { studyRef: parsed.options.study } : {}),
      });
      printOutput(data, parsed);
      return;
    }

    case 'import-transcript': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, {
        resourceArgCount: 1,
        commandLabel: 'interview import-transcript',
      });
      const filePath = args[0];

      let fileInfo: Awaited<ReturnType<typeof stat>>;
      try {
        fileInfo = await stat(filePath);
      } catch (error) {
        fail(`Cannot read transcript file "${filePath}": ${(error as Error).message}`);
      }
      if (!fileInfo.isFile()) {
        fail(`Transcript path must be a file: ${filePath}`);
      }

      const buffer = await readFile(filePath);
      const contentType = readUploadContentTypeOption(parsed, 'content-type') ?? 'text/plain; charset=utf-8';
      const formData = new FormData();
      formData.set('transcript', new Blob([buffer], { type: contentType }), basename(filePath));
      formData.set('import_source', 'cli');
      if (parsed.options.name && parsed.options.name !== 'true') {
        formData.set('participant_name', parsed.options.name);
      }
      if (parsed.options.email && parsed.options.email !== 'true') {
        formData.set('participant_email', parsed.options.email);
      }
      if (parsed.options.study && parsed.options.study !== 'true') {
        formData.set('study_ref', parsed.options.study);
      }

      const data = await requestProjectContractFormDataJson('sessionImportTranscript', {
        env,
        projectRef: projectId,
        formData,
      });
      printOutput(data, parsed);

      if (getBooleanOption(parsed, 'wait')) {
        const session = (data as Record<string, unknown>).session as { id?: string } | undefined;
        const sessionId = session?.id;
        if (!sessionId) {
          fail('Import succeeded but response did not include an interview id.');
        }
        const timeoutStr = parsed.options.timeout && parsed.options.timeout !== 'true' ? parsed.options.timeout : '120';
        const timeoutSec = parseInt(timeoutStr, 10);
        if (isNaN(timeoutSec) || timeoutSec < 1) fail('--timeout must be a positive integer (seconds)');

        await pollUntilDone({
          env,
          projectId,
          sessionId,
          intervalMs: 3000,
          timeoutMs: timeoutSec * 1000,
          json: isJsonOutput(parsed),
        });
      }
      return;
    }

    case 'get': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview get' });
      const sessionId = args[0];

      const data = await requestProjectContractJson('sessionGet', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      });
      printOutput(data, parsed);
      return;
    }

    // ── Phase 1.1: session status ──────────────────────────────────────────
    case 'status': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview status' });
      const sessionId = args[0];

      const data = await fetchSessionDetail(env, projectId, sessionId);
      const { session } = data;

      const processingDetails = await fetchProcessingStatus(env, projectId, sessionId);
      const processingStatus = processingDetails.status;
      const signalCount = processingDetails.signals;
      const hasAudio = hasChunkBackedAudioMedia(data);
      const hasScreen = hasChunkBackedScreenMedia(data);
      const taskCount = processingDetails.tasks_suggested;

      if (isJsonOutput(parsed)) {
        console.log(JSON.stringify({
          interview: session,
          processing_status: processingStatus,
          evidence_count: signalCount,
          finding_count: taskCount,
          analysis_summary: session.analysis_summary ?? null,
          ...(processingDetails.error && { error: processingDetails.error }),
          ...(processingDetails.error_code && { error_code: processingDetails.error_code }),
          ...(processingDetails.error_action && { error_action: processingDetails.error_action }),
          ...(processingDetails.retryable !== undefined && { retryable: processingDetails.retryable }),
          ...(processingDetails.current_step && { current_step: processingDetails.current_step }),
          ...(processingDetails.last_step_status && { last_step_status: processingDetails.last_step_status }),
          ...(processingDetails.last_step_duration_ms !== undefined
            && { last_step_duration_ms: processingDetails.last_step_duration_ms }),
          media: { audio: hasAudio, screen: hasScreen },
        }, null, 2));
      } else {
        const processingDetail = processingStatus === 'processed'
          ? `processed (${signalCount} Evidence, ${taskCount} Findings suggested)`
          : processingStatus;

        console.log(`Interview:   ${session.id}`);
        console.log(`Status:      ${session.status}`);
        console.log(`Processing:  ${processingDetail}`);
        console.log(`Duration:    ${formatDuration(session.duration_seconds)}`);
        console.log(`Audio:       ${hasAudio ? 'available' : 'not available'}`);
        console.log(`Screen:      ${hasScreen ? 'available' : 'not available'}`);
        console.log(`Evidence:    ${signalCount}`);
        if (session.analysis_summary?.trim()) console.log(`Analysis:    ${session.analysis_summary.trim()}`);
        if (processingDetails.error) console.log(`Reason:      ${processingDetails.error}`);
        if (processingDetails.error_action) console.log(`Action:      ${processingDetails.error_action}`);
      }
      return;
    }

    case 'update': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview update' });
      const sessionId = args[0];

      const body: Record<string, unknown> = {};
      if (parsed.options.status && parsed.options.status !== 'true') {
        body.status = parsed.options.status;
      }
      if (parsed.options.summary && parsed.options.summary !== 'true') {
        body.summary = parsed.options.summary;
      }

      if (Object.keys(body).length === 0) {
        fail('No update fields provided. Use --status or --summary');
      }

      const data = await requestProjectContractJson('sessionPatch', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
        body,
      });
      printOutput(data, parsed);
      return;
    }

    case 'delete': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview delete' });
      const sessionId = args[0];

      const data = await requestProjectContractJson('sessionDelete', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      });
      printOutput(data, parsed);
      return;
    }

    // ── Phase 2.2: transcript (R2 first, then fallback) ────────────────────
    case 'transcript': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview transcript' });
      const sessionId = args[0];

      const useRaw = getBooleanOption(parsed, 'raw');

      // Try R2 transcript first (unless --raw)
      if (!useRaw && !getBooleanOption(parsed, 'json')) {
        const r2Text = await requestProjectContractText('sessionTranscript', {
          env,
          projectRef: projectId,
          pathParams: { sessionId },
        });
        if (r2Text !== null) {
          console.log(r2Text);
          return;
        }
      }

      // Fallback: rebuild from messages
      const data = await requestProjectContractJson('sessionGet', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      }) as Record<string, unknown>;

      if (getBooleanOption(parsed, 'json')) {
        const messages = data.messages ?? [];
        console.log(JSON.stringify(messages, null, 2));
      } else {
        const messages = (data.messages ?? []) as Array<{ role: string; content: string; created_at?: string }>;
        if (messages.length === 0) {
          console.log('No messages in this interview.');
        } else {
          for (const msg of messages) {
            const label = msg.role === 'user' ? 'Participant' : msg.role === 'interviewer' ? 'Interviewer' : 'System';
            console.log(`[${label}] ${msg.content}`);
          }
        }
      }
      return;
    }

    // ── Phase 2.4: timeline ────────────────────────────────────────────────
    case 'timeline': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview timeline' });
      const sessionId = args[0];

      const r2Text = await requestProjectContractText('sessionTimeline', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      });

      if (r2Text === null) {
        fail('No timeline available for this interview.');
      }

      if (isJsonOutput(parsed)) {
        // Try to parse and re-output as formatted JSON
        try {
          const parsed_data = JSON.parse(r2Text);
          console.log(JSON.stringify(remapVocabTopLevelKeys(parsed_data), null, 2));
        } catch {
          console.log(r2Text);
        }
      } else {
        console.log(r2Text);
      }
      return;
    }

    // ── Enriched timeline ────────────────────────────────────────────────
    case 'enriched-timeline': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview enriched-timeline' });
      const sessionId = args[0];

      const r2Text = await requestProjectContractText('sessionEnrichedTimeline', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      });

      if (r2Text === null) {
        fail('No enriched timeline available for this interview.');
      }

      if (isJsonOutput(parsed)) {
        try {
          const parsed_data = JSON.parse(r2Text);
          console.log(JSON.stringify(remapVocabTopLevelKeys(parsed_data), null, 2));
        } catch {
          console.log(r2Text);
        }
      } else {
        type TimelineEntry = {
          ts: number;
          end?: number;
          type: string;
          speaker?: string;
          content?: string;
          annotations?: {
            pace_wpm?: number;
            pace_label?: string;
            hesitation?: boolean;
            filler_words?: string[];
            pause_duration_ms?: number;
          };
        };

        let entries: TimelineEntry[];
        try {
          entries = JSON.parse(r2Text) as TimelineEntry[];
        } catch {
          console.log(r2Text);
          return;
        }

        for (const entry of entries) {
          const mins = Math.floor(entry.ts / 60000);
          const secs = Math.floor((entry.ts % 60000) / 1000);
          const time = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

          const parts: string[] = [`[${time}]`, entry.type];
          if (entry.speaker) parts.push(`[${entry.speaker}]`);
          if (entry.content) parts.push(entry.content);

          // Annotations
          const annParts: string[] = [];
          if (entry.annotations?.pace_label) {
            annParts.push(`pace:${entry.annotations.pace_label}${entry.annotations.pace_wpm ? `(${entry.annotations.pace_wpm}wpm)` : ''}`);
          }
          if (entry.annotations?.hesitation) {
            const fillers = entry.annotations.filler_words?.join(',');
            annParts.push(`hesitation${fillers ? `:${fillers}` : ''}`);
          }
          if (entry.annotations?.pause_duration_ms) {
            annParts.push(`${(entry.annotations.pause_duration_ms / 1000).toFixed(1)}s`);
          }
          if (annParts.length > 0) parts.push(`(${annParts.join(', ')})`);

          console.log(parts.join(' '));
        }
      }
      return;
    }

    // ── Phase 1.4: media (absolute URLs) ───────────────────────────────────
    case 'media': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview media' });
      const sessionId = args[0];

      const baseUrl = resolveBaseUrl(env);

      const data = await requestProjectContractJson('sessionGet', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      }) as ApiSessionDetailResponse;

      const audioAvailability = describeMediaAvailability({
        merged: Boolean(data.session.audio_media_key),
        chunkBacked: data.audioChunks.length > 0,
      });
      const screenAvailability = describeMediaAvailability({
        merged: Boolean(data.session.screen_media_key),
        chunkBacked: (data.screenManifest?.chunks.length ?? 0) > 0,
      });
      const audioUrl = `${baseUrl}${projectApi(projectId)}/sessions/${encodeURIComponent(sessionId)}/media/audio/full`;
      const screenUrl = `${baseUrl}${projectApi(projectId)}/sessions/${encodeURIComponent(sessionId)}/media/screen/full`;

      const result = {
        audio: { ...audioAvailability, url: audioAvailability.available ? audioUrl : null },
        screen: { ...screenAvailability, url: screenAvailability.available ? screenUrl : null },
      };

      if (isJsonOutput(parsed)) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Interview: ${sessionId}`);
        console.log(`Audio:  ${formatMediaAvailability(audioAvailability, audioUrl)}`);
        console.log(`Screen: ${formatMediaAvailability(screenAvailability, screenUrl)}`);
      }
      return;
    }

    // ── Phase 2.5: audio download ──────────────────────────────────────────
    case 'audio': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview audio' });
      const sessionId = args[0];

      const outputOpt = parsed.options.output && parsed.options.output !== 'true' ? parsed.options.output : null;
      const outPath = outputOpt || `${sessionId}-audio.webm`;

      const buffer = await requestProjectContractBinary('sessionMediaAudioFull', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      });
      await writeFile(outPath, buffer);
      console.log(`Downloaded audio → ${outPath} (${buffer.byteLength} bytes)`);
      return;
    }

    // ── Screen download ─────────────────────────────────────────────────
    case 'screen': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview screen' });
      const sessionId = args[0];

      const outputOpt = parsed.options.output && parsed.options.output !== 'true' ? parsed.options.output : null;
      const outPath = outputOpt || `${sessionId}-screen.webm`;

      const buffer = await requestProjectContractBinary('sessionMediaScreenFull', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      });
      await writeFile(outPath, buffer);
      console.log(`Downloaded screen recording → ${outPath} (${buffer.byteLength} bytes)`);
      return;
    }

    case 'reprocess': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview reprocess' });
      const sessionId = args[0];

      const data = await requestProjectContractJson('sessionReprocess', {
        env,
        projectRef: projectId,
        pathParams: { sessionId },
      });
      printOutput(data, parsed);

      if (getBooleanOption(parsed, 'wait')) {
        const timeoutStr = parsed.options.timeout && parsed.options.timeout !== 'true' ? parsed.options.timeout : '120';
        const timeoutSec = parseInt(timeoutStr, 10);
        if (isNaN(timeoutSec) || timeoutSec < 1) fail('--timeout must be a positive integer (seconds)');

        await pollUntilDone({
          env,
          projectId,
          sessionId,
          intervalMs: 3000,
          timeoutMs: timeoutSec * 1000,
          json: isJsonOutput(parsed),
        });
      }
      return;
    }

    case 'watch': {
      const { projectRef: projectId, args } = await consumeProjectRef(parsed, env, { resourceArgCount: 1, commandLabel: 'interview watch' });
      const sessionId = args[0];

      const intervalStr = parsed.options.interval && parsed.options.interval !== 'true' ? parsed.options.interval : '4';
      const intervalSec = parseInt(intervalStr, 10);
      if (isNaN(intervalSec) || intervalSec < 1) fail('--interval must be a positive integer (seconds)');

      await pollUntilDone({
        env,
        projectId,
        sessionId,
        intervalMs: intervalSec * 1000,
        timeoutMs: Infinity,
        json: isJsonOutput(parsed),
        verbose: getBooleanOption(parsed, 'verbose'),
        signals: getBooleanOption(parsed, 'evidence'),
      });
      return;
    }

    default:
      fail(`Unknown interview command: ${subcommand}`);
  }
}
