export const MAX_IMPORTED_MEDIA_BYTES = 20 * 1024 * 1024 * 1024;

const IMPORTED_MEDIA_MIME_TYPES: ReadonlyMap<string, 'audio' | 'video'> = new Map([
  ['audio/aac', 'audio'],
  ['audio/flac', 'audio'],
  ['audio/mp4', 'audio'],
  ['audio/mpeg', 'audio'],
  ['audio/mpga', 'audio'],
  ['audio/ogg', 'audio'],
  ['audio/wav', 'audio'],
  ['audio/webm', 'audio'],
  ['audio/x-m4a', 'audio'],
  ['video/mp4', 'video'],
  ['video/mpeg', 'video'],
  ['video/quicktime', 'video'],
  ['video/webm', 'video'],
] as const);

export function getImportedMediaKind(
  contentType: string | null | undefined,
): 'audio' | 'video' | null {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  return normalized ? IMPORTED_MEDIA_MIME_TYPES.get(normalized) ?? null : null;
}

export function resolveImportedMediaContentType(
  contentType: string | null | undefined,
  filename: string,
): string | null {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized && IMPORTED_MEDIA_MIME_TYPES.has(normalized)) return normalized;
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (extension) {
    case 'aac': return 'audio/aac';
    case 'flac': return 'audio/flac';
    case 'm4a': return 'audio/mp4';
    case 'mp3':
    case 'mpga': return 'audio/mpeg';
    case 'ogg': return 'audio/ogg';
    case 'wav': return 'audio/wav';
    case 'm4v':
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'mpeg':
    case 'mpg': return 'video/mpeg';
    case 'webm': return 'video/webm';
    default: return null;
  }
}

export function importedMediaMimeTypeToExtension(contentType: string): string {
  const normalized = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized === 'video/quicktime') return 'mov';
  if (normalized === 'audio/mpeg' || normalized === 'audio/mpga') return 'mp3';
  if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') return 'm4a';
  const subtype = normalized?.split('/')[1]?.replace('x-', '');
  return subtype || 'bin';
}
