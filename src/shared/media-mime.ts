const DEFAULT_AUDIO_MIME_TYPE = 'audio/webm';
const MULTIPART_NON_WEBM_AUDIO_MERGEABLE_MIME_TYPES = new Set(['audio/mp4', 'audio/x-m4a', 'audio/ogg']);
const TRANSCRIPTION_MEDIA_MIME_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'video/mp4',
  'video/mpeg',
  'video/webm',
]);

export function normalizeAudioMimeType(mimeType: string | null | undefined): string {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  return normalized?.startsWith('audio/') ? normalized : DEFAULT_AUDIO_MIME_TYPE;
}

export function isWebmMimeType(mimeType: string | null | undefined): boolean {
  return normalizeAudioMimeType(mimeType) === 'audio/webm';
}

export function canMergeMultipartNonWebmAudioMimeType(mimeType: string | null | undefined): boolean {
  return MULTIPART_NON_WEBM_AUDIO_MERGEABLE_MIME_TYPES.has(normalizeAudioMimeType(mimeType));
}

export function audioMimeTypeToExtension(mimeType: string | null | undefined): string {
  switch (normalizeAudioMimeType(mimeType)) {
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/mp4':
    case 'audio/x-m4a':
      return 'm4a';
    case 'audio/wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/flac':
      return 'flac';
    case 'audio/aac':
      return 'aac';
    default:
      return 'webm';
  }
}

export function normalizeTranscriptionMediaMimeType(mimeType: string | null | undefined): string {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  return normalized && TRANSCRIPTION_MEDIA_MIME_TYPES.has(normalized)
    ? normalized
    : DEFAULT_AUDIO_MIME_TYPE;
}

export function isSupportedTranscriptionMediaMimeType(mimeType: string | null | undefined): boolean {
  const normalized = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  return Boolean(normalized && TRANSCRIPTION_MEDIA_MIME_TYPES.has(normalized));
}

export function transcriptionMediaMimeTypeToExtension(mimeType: string | null | undefined): string {
  switch (normalizeTranscriptionMediaMimeType(mimeType)) {
    case 'audio/aac':
      return 'aac';
    case 'audio/flac':
      return 'flac';
    case 'audio/mp4':
    case 'audio/x-m4a':
      return 'm4a';
    case 'audio/mpeg':
    case 'audio/mpga':
      return 'mp3';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
      return 'wav';
    case 'video/mp4':
      return 'mp4';
    case 'video/mpeg':
      return 'mpeg';
    case 'video/webm':
    case 'audio/webm':
    default:
      return 'webm';
  }
}
