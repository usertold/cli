import process from 'node:process';
import type { CliEnvironment } from './types';
import { loadStoredConfig, resolveBaseUrl } from './config';
import { CliError, failAuth, EXIT_AUTH, EXIT_NOT_FOUND } from './errors';
import { buildCliUserAgent } from './user-agent';
import { assertSideEffectAllowed } from './dry-run';

export type AuthMode = 'required' | 'optional' | 'none';

export type ApiRequest = {
  env: CliEnvironment;
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  authMode?: AuthMode;
  projectKey?: string;
};

export type ApiResponse = {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  json: unknown | null;
};

export type RequestRetryOptions = {
  retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (context: { attempt: number; response?: ApiResponse; error?: unknown }) => boolean;
};

export class HttpError extends CliError {
  status: number;
  details: string;

  constructor(status: number, details: string) {
    const exitCode = status === 401 || status === 403
      ? EXIT_AUTH
      : status === 404
        ? EXIT_NOT_FOUND
        : 1;
    super(`HTTP ${status}: ${details}`, exitCode);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export async function requestJson<T = unknown>(input: ApiRequest, retryOptions?: RequestRetryOptions): Promise<T> {
  const response = await requestRaw(input, retryOptions);

  if (!response.ok) {
    throw new HttpError(response.status, extractErrorDetails(response));
  }

  if (response.json !== null) {
    return response.json as T;
  }

  return response.text as T;
}

export async function requestFormDataJson<T = unknown>(
  input: Omit<ApiRequest, 'body'> & { formData: FormData },
  retryOptions?: RequestRetryOptions,
): Promise<T> {
  const response = await requestFormDataRaw(input, retryOptions);

  if (!response.ok) {
    throw new HttpError(response.status, extractErrorDetails(response));
  }

  if (response.json !== null) {
    return response.json as T;
  }

  return response.text as T;
}

/**
 * Fetch a text/plain response. Returns null on 404 (useful for optional R2 objects).
 * Throws on other non-OK status codes.
 */
export async function requestText(input: ApiRequest): Promise<string | null> {
  const response = await requestRaw({
    ...input,
    headers: { ...input.headers, accept: 'text/plain' },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new HttpError(response.status, extractErrorDetails(response));
  }

  return response.text;
}

/**
 * Fetch a binary response as a Buffer (for downloading media files).
 */
export async function requestBinary(input: ApiRequest): Promise<Buffer> {
  const method = input.method.toUpperCase();
  const authMode = input.authMode ?? 'required';
  const headers: Record<string, string> = {
    accept: 'application/octet-stream',
    'user-agent': buildCliUserAgent(),
    ...input.headers,
  };

  if (input.projectKey) {
    headers['X-Project-Key'] = input.projectKey;
  }

  const token = await resolveToken(input.env, authMode);
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  if (input.env === 'local') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const baseUrl = resolveBaseUrl(input.env);
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    const details = text.trim().length > 0 ? text : 'Request failed';
    throw new HttpError(response.status, details);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function requestRaw(input: ApiRequest, retryOptions?: RequestRetryOptions): Promise<ApiResponse> {
  const body = input.body !== undefined ? JSON.stringify(input.body) : undefined;
  const headers = { ...input.headers };
  if (body) {
    headers['content-type'] = headers['content-type'] ?? 'application/json';
  }

  return requestFetchRaw({ ...input, headers, body }, retryOptions);
}

async function requestFormDataRaw(
  input: Omit<ApiRequest, 'body'> & { formData: FormData },
  retryOptions?: RequestRetryOptions,
): Promise<ApiResponse> {
  return requestFetchRaw({
    env: input.env,
    method: input.method,
    path: input.path,
    headers: input.headers,
    authMode: input.authMode,
    projectKey: input.projectKey,
    body: input.formData,
  }, retryOptions);
}

async function requestFetchRaw(
  input: ApiRequest & { body?: BodyInit },
  retryOptions?: RequestRetryOptions,
): Promise<ApiResponse> {
  const method = input.method.toUpperCase();
  if (!isReadOnlyMethod(method)) {
    assertSideEffectAllowed(`HTTP ${method} ${input.path}`);
  }
  const authMode = input.authMode ?? 'required';
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': buildCliUserAgent(),
    ...input.headers,
  };

  if (input.projectKey) {
    headers['X-Project-Key'] = input.projectKey;
  }

  const token = await resolveToken(input.env, authMode);
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  if (input.env === 'local') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const baseUrl = resolveBaseUrl(input.env);
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  const url = `${baseUrl}${path}`;

  const retries = retryOptions?.retries ?? 0;
  const initialDelayMs = retryOptions?.initialDelayMs ?? 500;
  const maxDelayMs = retryOptions?.maxDelayMs ?? 4_000;

  let delayMs = initialDelayMs;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: input.body,
      });
      const parsed = await toApiResponse(response);

      if (attempt >= retries || !retryOptions?.shouldRetry?.({ attempt, response: parsed })) {
        return parsed;
      }

      const retryAfterMs = parseRetryAfterMs(parsed.headers.get('Retry-After'));
      await sleep(jitter(retryAfterMs ?? delayMs));
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !retryOptions?.shouldRetry?.({ attempt, error })) {
        throw error;
      }

      await sleep(jitter(delayMs));
    }

    delayMs = Math.min(maxDelayMs, delayMs * 2);
  }

  throw lastError ?? new Error('Request failed');
}

function isReadOnlyMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

async function resolveToken(env: CliEnvironment, authMode: AuthMode): Promise<string | null> {
  if (authMode === 'none') {
    return null;
  }

  // Check env var first — enables headless CI/CD usage
  if (process.env.USERTOLD_API_KEY) {
    return process.env.USERTOLD_API_KEY;
  }

  const config = await loadStoredConfig(env);
  if (!config) {
    if (authMode === 'required') {
      failAuth(`Not authenticated for environment "${env}". Run "usertold auth login -- --env ${env}" first.`);
    }
    return null;
  }

  if (config.token.expiresAt <= Date.now()) {
    if (authMode === 'required') {
      failAuth(`Stored token for environment "${env}" is expired. Run "usertold auth login -- --env ${env}" again.`);
    }
    return null;
  }

  return config.token.accessToken;
}

function extractErrorDetails(response: ApiResponse): string {
  if (isCloudflare1010Response(response)) {
    return 'Cloudflare blocked this request (error 1010). Wait a few seconds and retry, or run pushes sequentially.';
  }

  if (response.json && typeof response.json === 'object' && response.json !== null) {
    const body = response.json as Record<string, unknown>;
    const maybeErrorCode = body.error_code;
    const maybeError = body.error;
    const maybeNeedsOnboarding = body.needs_onboarding;
    const needsOrgHandleReview = body.needs_org_handle_review;
    const needsTermsAcceptance = body.needs_terms_acceptance;

    // The onboarding gate (auth-middleware) sends `code`/`error`; some legacy
    // payloads use `error_code`. Match any so the terms-changed case always
    // surfaces an actionable message instead of a raw 403 body.
    const onboardingSignalled = maybeErrorCode === 'onboarding_required'
      || body.code === 'onboarding_required'
      || maybeError === 'onboarding_required'
      || maybeNeedsOnboarding === true;

    if (onboardingSignalled) {
      if (needsTermsAcceptance) {
        return 'The Terms of Service have changed and must be accepted before continuing. '
          + 'Review them with `usertold auth terms`, then accept with `usertold auth terms accept`.';
      }
      if (needsOrgHandleReview) {
        return 'Onboarding required: your organization handle/name needs review. Complete onboarding in the app.';
      }
      return 'Onboarding required. Complete onboarding before continuing.';
    }

    if (typeof maybeError === 'string' && maybeError.length > 0) {
      return maybeError;
    }

    const maybeMessage = (response.json as Record<string, unknown>).message;
    if (typeof maybeMessage === 'string' && maybeMessage.length > 0) {
      return maybeMessage;
    }
  }

  if (response.text.trim().length > 0) {
    return response.text.trim();
  }

  return 'Request failed';
}

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function toApiResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const json = contentType.includes('application/json') && text.length > 0
    ? safeParseJson(text)
    : null;

  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    text,
    json,
  };
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) {
    return null;
  }

  return Math.max(0, dateMs - Date.now());
}

function jitter(ms: number): number {
  return ms * (0.7 + Math.random() * 0.6);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isCloudflare1010Response(response: Pick<ApiResponse, 'text' | 'json'>): boolean {
  const text = response.text.toLowerCase();
  if (text.includes('error code 1010') || text.includes('error code: 1010')) {
    return true;
  }

  return text.includes('access denied') && text.includes("browser's signature");
}
