export const TARGET_SURFACES = [
  'product_under_test',
  'usertold_widget_interview',
  'interviewer_conductor_behavior',
  'ambiguous_needs_review',
] as const;

export type TargetSurface = typeof TARGET_SURFACES[number];
export type TargetSurfaceFilter = TargetSurface | 'all';
export const TARGET_SURFACE_FILTERS = [...TARGET_SURFACES, 'all'] as const;

const TARGET_SURFACE_SET = new Set<string>(TARGET_SURFACES);

export function isTargetSurface(value: unknown): value is TargetSurface {
  return typeof value === 'string' && TARGET_SURFACE_SET.has(value);
}

export function normalizeTargetSurface(value: unknown): TargetSurface {
  return isTargetSurface(value) ? value : 'product_under_test';
}

export function normalizeTargetSurfaceFilter(value: unknown): TargetSurfaceFilter {
  return value === 'all' ? 'all' : normalizeTargetSurface(value);
}

export function deriveTargetSurfaceFromSignals(
  signals: Array<{ target_surface?: string | null }>,
): TargetSurface {
  if (signals.length === 0) return 'product_under_test';

  const surfaces = new Set(signals.map(signal => normalizeTargetSurface(signal.target_surface)));
  if (surfaces.size === 1) return [...surfaces][0] ?? 'product_under_test';
  return 'ambiguous_needs_review';
}
