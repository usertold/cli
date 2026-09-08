export interface KnowledgeActionInput {
  name: string;
  when_to_use: string;
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string | null>;
  body?: Record<string, unknown> | null;
  response_path?: string | null;
}

export type KnowledgeActionValidation =
  | { success: true; data: KnowledgeActionInput }
  | { success: false; issues: string[] };

type OptionalValue<T> =
  | { present: false }
  | { present: true; value: T };

export function validateKnowledgeActionInput(input: unknown): KnowledgeActionValidation {
  if (!isRecord(input)) return { success: false, issues: ['Expected an object'] };

  const issues: string[] = [];
  const name = requireBoundedString(input.name, 'name', 120, issues);
  const whenToUse = requireBoundedString(input.when_to_use, 'when_to_use', 1_000, issues);
  const url = requireBoundedString(input.url, 'url', 2_000, issues);
  const method = input.method === 'GET' || input.method === 'POST' ? input.method : null;
  if (!method) issues.push('method must be GET or POST');

  const headers = input.headers === undefined ? {} : readHeaders(input.headers, issues);
  const body = readOptionalRecord(input.body, 'body', issues);
  const responsePath = readOptionalNullableString(input.response_path, 'response_path', 500, issues);

  if (issues.length > 0 || !name || !whenToUse || !url || !method || !headers) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      name,
      when_to_use: whenToUse,
      method,
      url,
      headers,
      ...(body.present ? { body: body.value } : {}),
      ...(responsePath.present ? { response_path: responsePath.value } : {}),
    },
  };
}

function requireBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
  issues: string[],
): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    issues.push(`${field} must be a non-empty string of at most ${maxLength} characters`);
    return null;
  }
  return value;
}

function readHeaders(value: unknown, issues: string[]): Record<string, string | null> | null {
  if (!isRecord(value)) {
    issues.push('headers must be an object');
    return null;
  }
  const headers: Record<string, string | null> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue !== 'string' && headerValue !== null) {
      issues.push(`headers.${key} must be a string or null`);
      continue;
    }
    headers[key] = headerValue;
  }
  return headers;
}

function readOptionalRecord(
  value: unknown,
  field: string,
  issues: string[],
): OptionalValue<Record<string, unknown> | null> {
  if (value === undefined) return { present: false };
  if (value === null) return { present: true, value: null };
  if (!isRecord(value)) {
    issues.push(`${field} must be an object or null`);
    return { present: false };
  }
  return { present: true, value };
}

function readOptionalNullableString(
  value: unknown,
  field: string,
  maxLength: number,
  issues: string[],
): OptionalValue<string | null> {
  if (value === undefined) return { present: false };
  if (value === null) return { present: true, value: null };
  if (typeof value !== 'string' || value.length > maxLength) {
    issues.push(`${field} must be a string of at most ${maxLength} characters or null`);
    return { present: false };
  }
  return { present: true, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
