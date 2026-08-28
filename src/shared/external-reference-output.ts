const PROJECT_ID_PREFIX = 'prj_';
const STUDY_ID_PREFIX = 'sty_';

type JsonRecord = Record<string, unknown>;

/**
 * Keeps immutable project/study IDs inside persistence and internal payloads.
 * CLI and MCP call this at their output boundaries as defence in depth so
 * implementation identifiers cannot accidentally become copyable references.
 */
export function presentExternalProjectStudyRefs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(presentExternalProjectStudyRefs);
  }

  if (!isRecord(value)) {
    return value;
  }

  const projectRef = readableProjectRef(value);
  const studyRef = readableStudyRef(value);
  const presented: JsonRecord = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === 'project_id' || key === 'projectId') {
      const ref = projectRef ?? readableReferenceValue(child, PROJECT_ID_PREFIX);
      if (ref) presented[key === 'projectId' ? 'projectRef' : 'project_ref'] = ref;
      continue;
    }

    if (key === 'study_id' || key === 'studyId') {
      const ref = studyRef ?? readableReferenceValue(child, STUDY_ID_PREFIX);
      if (ref) presented[key === 'studyId' ? 'studyRef' : 'study_ref'] = ref;
      continue;
    }

    // `id` is polymorphic in nested user-authored data such as study scripts.
    // Only rewrite it when the surrounding object also proves that it is a
    // project or study entity by carrying enough metadata for a readable ref.
    if (key === 'id' && isOpaqueProjectId(child) && projectRef) {
      presented.ref = projectRef;
      continue;
    }
    if (key === 'id' && isOpaqueStudyId(child) && studyRef) {
      presented.ref = studyRef;
      continue;
    }

    if ((key === 'projectRef' || key === 'project_ref') && isOpaqueProjectId(child)) {
      if (projectRef) presented[key] = projectRef;
      continue;
    }

    if ((key === 'studyRef' || key === 'study_ref') && isOpaqueStudyId(child)) {
      if (studyRef) presented[key] = studyRef;
      continue;
    }

    presented[key] = presentExternalProjectStudyRefs(child);
  }

  return presented;
}

export function containsOpaqueProjectStudyId(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.startsWith(PROJECT_ID_PREFIX) || value.startsWith(STUDY_ID_PREFIX);
  }
  if (Array.isArray(value)) {
    return value.some(containsOpaqueProjectStudyId);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).some(containsOpaqueProjectStudyId);
}

function readableProjectRef(value: JsonRecord): string | null {
  for (const key of ['projectRef', 'project_ref']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && !isOpaqueProjectId(candidate)) {
      return candidate;
    }
  }

  const orgHandle = stringValue(value.orgHandle) ?? stringValue(value.org_handle);
  const projectHandle = stringValue(value.projectHandle)
    ?? stringValue(value.project_handle)
    ?? (isOpaqueProjectId(value.id) ? stringValue(value.handle) : null);
  if (orgHandle && projectHandle) {
    return `${orgHandle}/${projectHandle}`;
  }
  return null;
}

function readableStudyRef(value: JsonRecord): string | null {
  for (const key of ['studyRef', 'study_ref', 'study_handle']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && !isOpaqueStudyId(candidate)) {
      return candidate;
    }
  }

  if (isOpaqueStudyId(value.id)) {
    return stringValue(value.handle);
  }
  return null;
}

function isOpaqueProjectId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PROJECT_ID_PREFIX);
}

function isOpaqueStudyId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(STUDY_ID_PREFIX);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readableReferenceValue(value: unknown, opaquePrefix: string): string | null {
  return typeof value === 'string' && value.length > 0 && !value.startsWith(opaquePrefix)
    ? value
    : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
