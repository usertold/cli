/**
 * Generate a nanoid-style unique identifier.
 * Uses crypto.getRandomValues which is available in Workers.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const DEFAULT_SIZE = 21;

export function generateId(size: number = DEFAULT_SIZE): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

/**
 * Generate an entity ID with a readable type prefix.
 * Example: prj_xxx, sty_xxx, ses_xxx.
 */
export function generateEntityId(prefix: string, size: number = 16): string {
  return `${prefix}_${generateId(size)}`;
}

/**
 * Generate a URL-safe slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 64);
}

/**
 * Generate SDK keys for projects
 */
export function generatePublicKey(): string {
  return `ut_pub_${generateId(24)}`;
}

export function generateSecretKey(): string {
  return `ut_sec_${generateId(32)}`;
}
