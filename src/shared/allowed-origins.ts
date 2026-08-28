export interface AllowedOriginValidationIssue {
  line: number;
  value: string;
  message: string;
}

export interface AllowedOriginValidationResult {
  origins: string[];
  issues: AllowedOriginValidationIssue[];
}

export function validateAllowedOrigins(values: readonly string[]): AllowedOriginValidationResult {
  const origins: string[] = [];
  const issues: AllowedOriginValidationIssue[] = [];
  const seen = new Set<string>();

  values.forEach((raw, index) => {
    const value = raw.trim();
    if (!value) return;

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      issues.push({
        line: index + 1,
        value,
        message: 'Enter a full origin like https://app.example.com.',
      });
      return;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      issues.push({
        line: index + 1,
        value,
        message: 'Allowed origins must start with http:// or https://.',
      });
      return;
    }

    if (parsed.username || parsed.password || (parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
      issues.push({
        line: index + 1,
        value,
        message: `Use only the origin ${parsed.origin}, without paths, query strings, or fragments.`,
      });
      return;
    }

    if (!seen.has(parsed.origin)) {
      seen.add(parsed.origin);
      origins.push(parsed.origin);
    }
  });

  return { origins, issues };
}

export function formatAllowedOriginValidationError(issues: readonly AllowedOriginValidationIssue[]): string {
  const first = issues[0];
  if (!first) return 'Allowed origins are invalid.';

  const suffix = issues.length > 1 ? ` (${issues.length} invalid origins total)` : '';
  return `Allowed origin line ${first.line} (${first.value}): ${first.message}${suffix}`;
}

export function formatInterviewWebsiteValidationError(
  issues: readonly AllowedOriginValidationIssue[],
): string {
  const first = issues[0];
  if (!first) return 'Interview websites are invalid.';

  const suffix = issues.length > 1 ? ` (${issues.length} invalid websites total)` : '';
  return `Interview website line ${first.line} (${first.value}) must be a full website address such as https://app.example.com, without a page path or query.${suffix}`;
}
