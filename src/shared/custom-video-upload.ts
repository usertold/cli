import { isSupportedTranscriptionMediaMimeType } from './media-mime';

export const MAX_CUSTOM_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_CUSTOM_VIDEO_UPLOAD_BYTES = MAX_CUSTOM_MEDIA_UPLOAD_BYTES;
export const MAX_CUSTOM_AUDIO_UPLOAD_BYTES = MAX_CUSTOM_MEDIA_UPLOAD_BYTES;
export const MAX_CUSTOM_PLAYBACK_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;

export type CustomMediaUploadKind = 'audio' | 'video';

export interface CustomVideoUploadMetadata {
  sizeBytes: number;
  contentType: string;
}

export function validateCustomVideoUploadMetadata(input: CustomVideoUploadMetadata): string | null {
  return validateCustomMediaUploadMetadata(input, { expectedKind: null, maxBytes: MAX_CUSTOM_MEDIA_UPLOAD_BYTES });
}

export function validateCustomAudioUploadMetadata(input: CustomVideoUploadMetadata): string | null {
  return validateCustomMediaUploadMetadata(input, { expectedKind: 'audio', maxBytes: MAX_CUSTOM_AUDIO_UPLOAD_BYTES });
}

export function validateCustomPlaybackVideoUploadMetadata(input: CustomVideoUploadMetadata): string | null {
  return validateCustomMediaUploadMetadata(input, { expectedKind: 'video', maxBytes: MAX_CUSTOM_PLAYBACK_VIDEO_UPLOAD_BYTES });
}

function validateCustomMediaUploadMetadata(
  input: CustomVideoUploadMetadata,
  options: { expectedKind: CustomMediaUploadKind | null; maxBytes: number },
): string | null {
  if (!input || typeof input !== 'object'
    || !Number.isInteger(input.sizeBytes) || input.sizeBytes < 0
    || typeof input.contentType !== 'string') {
    return 'Invalid media upload metadata';
  }

  if (input.sizeBytes === 0) {
    return options.expectedKind ? `${options.expectedKind} file is empty` : 'media file is empty';
  }

  if (input.sizeBytes > options.maxBytes) {
    const maxMb = options.maxBytes / (1024 * 1024);
    const label = options.expectedKind === 'video' ? 'Video' : options.expectedKind === 'audio' ? 'Audio' : 'Recording';
    return `${label} exceeds the ${maxMb}MB upload limit`;
  }

  const contentType = input.contentType || 'application/octet-stream';
  const kind = getCustomMediaUploadKind(contentType);
  if (!kind) {
    return 'Upload a supported audio or video file: mp3, m4a, wav, ogg, flac, aac, mp4, webm, or mpeg';
  }
  if (options.expectedKind && kind !== options.expectedKind) {
    return options.expectedKind === 'audio'
      ? 'Upload a supported audio file: mp3, m4a, wav, ogg, flac, aac, or webm'
      : 'Upload a supported video file: mp4, webm, or mpeg';
  }

  return null;
}

export function getCustomMediaUploadKind(contentType: string | null | undefined): CustomMediaUploadKind | null {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized || !isSupportedTranscriptionMediaMimeType(normalized)) {
    return null;
  }
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  return null;
}
