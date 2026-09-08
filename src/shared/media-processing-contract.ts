import { z } from 'zod';
import { MAX_IMPORTED_MEDIA_BYTES } from './imported-media';

export {
  getImportedMediaKind,
  importedMediaMimeTypeToExtension,
  MAX_IMPORTED_MEDIA_BYTES,
  resolveImportedMediaContentType,
} from './imported-media';

export const MEDIA_PROCESSING_CONTRACT_VERSION = 1 as const;
export const MEDIA_UPLOAD_PART_BYTES = 16 * 1024 * 1024;
export const MAX_MEDIA_AUDIO_CHUNKS = 96;
export const MAX_MEDIA_FRAMES = 60;

export const MediaUploadPartSchema = z.object({
  partNumber: z.number().int().min(1).max(10_000),
  etag: z.string().min(1),
});
export type MediaUploadPart = z.infer<typeof MediaUploadPartSchema>;

export const MediaUploadInitiateRequestSchema = z.object({
  filename: z.string().trim().min(1).max(256),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive().max(MAX_IMPORTED_MEDIA_BYTES),
  participantName: z.string().trim().max(256).optional(),
  participantEmail: z.string().trim().email().max(320).optional(),
  studyRef: z.string().trim().max(128).optional(),
});
export type MediaUploadInitiateRequest = z.infer<typeof MediaUploadInitiateRequestSchema>;

export const MediaUploadPartUrlRequestSchema = z.object({
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(10_000),
});
export type MediaUploadPartUrlRequest = z.infer<typeof MediaUploadPartUrlRequestSchema>;

export const MediaUploadCompleteRequestSchema = z.object({
  uploadId: z.string().min(1),
  parts: z.array(MediaUploadPartSchema).min(1).max(10_000),
});
export type MediaUploadCompleteRequest = z.infer<typeof MediaUploadCompleteRequestSchema>;

export const MediaProcessingOutputTargetSchema = z.object({
  index: z.number().int().nonnegative(),
  rawKey: z.string().min(1),
  canonicalKey: z.string().min(1),
  uploadUrl: z.string().url(),
});
export type MediaProcessingOutputTarget = z.infer<typeof MediaProcessingOutputTargetSchema>;

export const MediaProcessorInvocationSchema = z.object({
  contractVersion: z.literal(MEDIA_PROCESSING_CONTRACT_VERSION),
  jobId: z.string().min(1),
  sessionId: z.string().min(1),
  projectId: z.string().min(1),
  organizationId: z.string().min(1),
  sourceKey: z.string().min(1),
  sourceContentType: z.string().min(1),
  sourceSizeBytes: z.number().int().positive(),
});
export type MediaProcessorInvocation = z.infer<typeof MediaProcessorInvocationSchema>;

export const MediaProcessingJobRequestSchema = z.object({
  contractVersion: z.literal(MEDIA_PROCESSING_CONTRACT_VERSION),
  jobId: z.string().min(1),
  sessionId: z.string().min(1),
  source: z.object({
    r2Key: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    downloadUrl: z.string().url(),
  }),
  audioTargets: z.array(MediaProcessingOutputTargetSchema).max(MAX_MEDIA_AUDIO_CHUNKS),
  frameTargets: z.array(z.object({
    index: z.number().int().nonnegative(),
    timestampMs: z.number().int().nonnegative(),
    image: MediaProcessingOutputTargetSchema,
    text: MediaProcessingOutputTargetSchema,
  })).max(MAX_MEDIA_FRAMES),
  options: z.object({
    audioChunkSeconds: z.number().int().min(60).max(3_600),
    frameIntervalSeconds: z.number().int().min(5).max(600),
    maxFrames: z.number().int().min(1).max(MAX_MEDIA_FRAMES),
  }),
});
export type MediaProcessingJobRequest = z.infer<typeof MediaProcessingJobRequestSchema>;

export const MediaProcessingManifestSchema = z.object({
  contractVersion: z.literal(MEDIA_PROCESSING_CONTRACT_VERSION),
  jobId: z.string().min(1),
  sessionId: z.string().min(1),
  source: z.object({
    r2Key: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    durationMs: z.number().int().nonnegative(),
    formatName: z.string(),
    streams: z.array(z.object({
      index: z.number().int().nonnegative(),
      codecType: z.string(),
      codecName: z.string().nullable(),
      channels: z.number().int().positive().nullable(),
      sampleRate: z.number().int().positive().nullable(),
      width: z.number().int().positive().nullable(),
      height: z.number().int().positive().nullable(),
    })),
  }),
  audio: z.object({
    state: z.enum(['ready', 'no_audio']),
    chunks: z.array(z.object({
      index: z.number().int().nonnegative(),
      r2Key: z.string().min(1),
      startMs: z.number().int().nonnegative(),
      durationMs: z.number().int().positive(),
      contentType: z.literal('audio/webm'),
    })),
  }),
  frames: z.array(z.object({
    index: z.number().int().nonnegative(),
    timestampMs: z.number().int().nonnegative(),
    imageKey: z.string().min(1),
    textKey: z.string().min(1),
    contentType: z.literal('image/jpeg'),
  })),
  createdAt: z.string().datetime(),
});
export type MediaProcessingManifest = z.infer<typeof MediaProcessingManifestSchema>;

export interface MediaProcessorServiceBinding {
  fetch(request: Request): Promise<Response>;
}
