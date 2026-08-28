export const USER_DISPLAY_NAME_MAX_LENGTH = 80;
export const WORKSPACE_HANDLE_MIN_LENGTH = 3;
export const WORKSPACE_HANDLE_MAX_LENGTH = 64;
export const WORKSPACE_NAME_MAX_LENGTH = 80;

export const WORKSPACE_HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;

export function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

export function validateDisplayName(value: string, label = 'Display name'): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required`;
  }

  if (trimmed.length > USER_DISPLAY_NAME_MAX_LENGTH) {
    return `${label} must be ${USER_DISPLAY_NAME_MAX_LENGTH} characters or fewer`;
  }

  if (hasControlCharacters(trimmed)) {
    return `${label} cannot include control characters`;
  }

  return null;
}

export function validateWorkspaceName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Organization name is required';
  }

  if (trimmed.length > WORKSPACE_NAME_MAX_LENGTH) {
    return `Organization name must be ${WORKSPACE_NAME_MAX_LENGTH} characters or fewer`;
  }

  if (hasControlCharacters(trimmed)) {
    return 'Organization name cannot include control characters';
  }

  return null;
}

export function validateWorkspaceHandle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Workspace handle is required';
  }

  if (trimmed.length < WORKSPACE_HANDLE_MIN_LENGTH || trimmed.length > WORKSPACE_HANDLE_MAX_LENGTH) {
    return `Workspace handle must be ${WORKSPACE_HANDLE_MIN_LENGTH}-${WORKSPACE_HANDLE_MAX_LENGTH} characters`;
  }

  if (!WORKSPACE_HANDLE_PATTERN.test(trimmed)) {
    return 'Use lowercase letters, numbers, and hyphens. Start and end with a letter or number.';
  }

  return null;
}
