import { createWriteStream } from 'node:fs';
import { link, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import {
  INTERVIEW_ARTIFACT_AVAILABILITIES,
  INTERVIEW_ARTIFACT_KINDS,
  type InterviewArtifactAvailability,
  type InterviewArtifact,
  type InterviewArtifactKind,
  type InterviewArtifactManifest,
} from '../../shared/interview-artifacts';
import { buildCliUserAgent } from './user-agent';
import { CliError } from './errors';

export class ArtifactDownloadHttpError extends CliError {
  readonly status: number;

  constructor(status: number) {
    super(`Artifact download failed with HTTP ${status}.`);
    this.name = 'ArtifactDownloadHttpError';
    this.status = status;
  }
}

export function parseInterviewArtifactManifest(value: unknown): InterviewArtifactManifest {
  if (!isRecord(value) || typeof value.interviewRef !== 'string' || !Array.isArray(value.artifacts)) {
    throw new CliError('Artifact manifest response is invalid.');
  }
  if (value.artifacts.length !== INTERVIEW_ARTIFACT_KINDS.length) {
    throw new CliError(`Artifact manifest must contain ${INTERVIEW_ARTIFACT_KINDS.length} artifacts.`);
  }

  const seen = new Set<InterviewArtifactKind>();
  const artifacts = value.artifacts.map((candidate): InterviewArtifact => {
    if (!isRecord(candidate)
      || !isArtifactKind(candidate.kind)
      || !isArtifactAvailability(candidate.availability)
      || !(candidate.mimeType === null || typeof candidate.mimeType === 'string')
      || !(candidate.sizeBytes === null || (Number.isSafeInteger(candidate.sizeBytes) && Number(candidate.sizeBytes) >= 0))
      || !(candidate.downloadUrl === null || isSafeDownloadUrl(candidate.downloadUrl))
      || !(candidate.expiresAt === null || isTimestamp(candidate.expiresAt))) {
      throw new CliError('Artifact manifest response is invalid.');
    }
    if (seen.has(candidate.kind)) {
      throw new CliError(`Artifact manifest contains duplicate ${candidate.kind} entries.`);
    }
    seen.add(candidate.kind);
    if (candidate.availability === 'available' && (!candidate.downloadUrl || !candidate.expiresAt)) {
      throw new CliError(`Available artifact ${candidate.kind} is missing its download link or expiry.`);
    }
    if (candidate.availability !== 'available' && (candidate.downloadUrl !== null || candidate.expiresAt !== null)) {
      throw new CliError(`Unavailable artifact ${candidate.kind} unexpectedly includes a download link.`);
    }
    return candidate as InterviewArtifact;
  });

  for (const kind of INTERVIEW_ARTIFACT_KINDS) {
    if (!seen.has(kind)) throw new CliError(`Artifact manifest did not include ${kind}.`);
  }
  return { interviewRef: value.interviewRef, artifacts };
}

export function findArtifact(
  manifest: InterviewArtifactManifest,
  kind: InterviewArtifactKind,
): InterviewArtifact {
  const artifact = manifest.artifacts.find(candidate => candidate.kind === kind);
  if (!artifact) {
    throw new CliError(`Artifact manifest did not include ${kind}.`);
  }
  return artifact;
}

export function requireAvailableArtifact(
  manifest: InterviewArtifactManifest,
  kind: InterviewArtifactKind,
): InterviewArtifact & { downloadUrl: string } {
  const artifact = findArtifact(manifest, kind);
  if (artifact.availability !== 'available' || !artifact.downloadUrl) {
    throw new CliError(`Artifact ${kind} is ${formatAvailability(artifact.availability)}.`);
  }
  return artifact as InterviewArtifact & { downloadUrl: string };
}

export function artifactLinkIsExpired(artifact: InterviewArtifact, now = Date.now()): boolean {
  if (!artifact.expiresAt) return false;
  const expiresAt = Date.parse(artifact.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export async function fetchArtifactResponse(
  artifact: InterviewArtifact & { downloadUrl: string },
): Promise<Response> {
  const response = await fetch(artifact.downloadUrl, {
    headers: {
      accept: artifact.mimeType ?? 'application/octet-stream',
      'user-agent': buildCliUserAgent(),
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new ArtifactDownloadHttpError(response.status);
  }
  return response;
}

export type ArtifactDownloadResult = {
  path: string;
  sizeBytes: number;
};

export async function downloadArtifactResponse(
  artifact: InterviewArtifact & { downloadUrl: string },
  response: Response,
  requestedPath?: string,
): Promise<ArtifactDownloadResult> {
  if (!response.body) throw new CliError('Artifact download returned an empty response body.');

  const suggested = filenameFromContentDisposition(response.headers.get('content-disposition'))
    ?? defaultArtifactFilename(artifact.kind, artifact.mimeType);
  const destination = resolve(requestedPath ?? suggested);
  const temporary = join(dirname(destination), `.${basename(destination)}.part-${process.pid}-${randomUUID()}`);

  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as ReadableStream),
      createWriteStream(temporary, { flags: 'wx' }),
    );
    const file = await stat(temporary);
    if (artifact.sizeBytes !== null && file.size !== artifact.sizeBytes) {
      throw new CliError(`Artifact download was incomplete: expected ${artifact.sizeBytes} bytes, received ${file.size}.`);
    }

    // The temporary file lives beside the destination. Linking it into place
    // makes the complete file appear atomically and refuses to overwrite an
    // existing path.
    try {
      await link(temporary, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new CliError(`Refusing to overwrite existing file: ${destination}`);
      }
      throw error;
    }
    await rm(temporary, { force: true }).catch(() => undefined);
    return { path: destination, sizeBytes: file.size };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function defaultArtifactFilename(kind: InterviewArtifactKind, mimeType: string | null): string {
  if (kind === 'transcript_text') return 'interview-transcript.txt';
  if (kind === 'transcript_vtt') return 'interview-transcript.vtt';
  if (kind === 'events') return 'interview-events.jsonl';
  return kind === 'screen'
    ? `interview-screen.${extensionForMimeType(mimeType, 'webm')}`
    : `interview-audio.${extensionForMimeType(mimeType, 'webm')}`;
}

function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded) {
    try {
      const decoded = basename(decodeURIComponent(encoded.trim()));
      if (decoded && decoded !== '.' && decoded !== '..') return decoded;
    } catch {
      // Fall back to filename= or the MIME-derived name.
    }
  }
  const regular = /filename=(?:"([^"]+)"|([^;]+))/i.exec(value);
  const filename = basename((regular?.[1] ?? regular?.[2] ?? '').trim());
  return filename && filename !== '.' && filename !== '..' ? filename : null;
}

function extensionForMimeType(mimeType: string | null, fallback: string): string {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  const extensions: Record<string, string> = {
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/x-m4a': 'm4a',
    'video/mp4': 'mp4',
    'video/mpeg': 'mpeg',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  return normalized ? extensions[normalized] ?? fallback : fallback;
}

function formatAvailability(availability: InterviewArtifact['availability']): string {
  return availability.replaceAll('_', ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArtifactKind(value: unknown): value is InterviewArtifactKind {
  return typeof value === 'string' && (INTERVIEW_ARTIFACT_KINDS as readonly string[]).includes(value);
}

function isArtifactAvailability(value: unknown): value is InterviewArtifactAvailability {
  return typeof value === 'string' && (INTERVIEW_ARTIFACT_AVAILABILITIES as readonly string[]).includes(value);
}

function isSafeDownloadUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
