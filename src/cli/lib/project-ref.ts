import { failArgs } from './errors';

const PROJECT_ID_PREFIX = 'prj_';

export type CanonicalProjectRef = {
  orgHandle: string;
  projectHandle: string;
};

export type ParsedProjectRef = { kind: 'canonical'; value: CanonicalProjectRef };

export function parseProjectRef(
  projectRef: string,
  options: { sourceLabel?: string } = {},
): ParsedProjectRef {
  const sourceLabel = options.sourceLabel ?? 'project reference';
  const value = projectRef.trim();

  if (!value) {
    failArgs(`Missing ${sourceLabel}. Expected format: org/project`);
  }

  if (isProjectId(value)) {
    failArgs([
      `Invalid ${sourceLabel}: "${projectRef}".`,
      'This command requires canonical project refs in "org/project" format.',
      'Use something like "acme/checkout".',
    ].join(' '));
  }

  const parts = value.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    failArgs(`Invalid ${sourceLabel}: "${projectRef}". Expected format: org/project (example: acme/checkout).`);
  }

  const [orgHandle, projectHandle] = parts;
  return {
    kind: 'canonical',
    value: {
      orgHandle,
      projectHandle,
    },
  };
}

export function requireCanonicalProjectRef(
  projectRef: string,
  sourceLabel = 'project reference',
): CanonicalProjectRef {
  const parsed = parseProjectRef(projectRef, { sourceLabel });
  return parsed.value;
}

export function buildProjectApiPath(projectRef: CanonicalProjectRef, suffix = ''): string {
  const base = `/api/orgs/${encodeURIComponent(projectRef.orgHandle)}/projects/${encodeURIComponent(projectRef.projectHandle)}`;
  if (!suffix) {
    return base;
  }
  return suffix.startsWith('/') ? `${base}${suffix}` : `${base}/${suffix}`;
}

export function buildProjectApiPathFromRef(projectRefInput: string, suffix = '', sourceLabel = 'project reference'): string {
  const projectRef = requireCanonicalProjectRef(projectRefInput, sourceLabel);
  return buildProjectApiPath(projectRef, suffix);
}

function isProjectId(value: string): boolean {
  return value.startsWith(PROJECT_ID_PREFIX);
}
