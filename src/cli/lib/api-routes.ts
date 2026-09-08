import type { DashboardApiContractKey } from '../../shared/api-contracts';
import { cliApiRoutes } from './api-routes.generated';

export { cliApiRoutes };

export function buildCliApiPath(
  key: DashboardApiContractKey,
  params: Record<string, string> = {},
  query?: unknown,
): string {
  const route = cliApiRoutes[key];
  let resolvedPath: string = route.path;
  for (const [param, value] of Object.entries(params)) {
    resolvedPath = resolvedPath.replaceAll(`:${param}`, encodeURIComponent(String(value)));
  }

  const unresolved = resolvedPath.match(/:[a-zA-Z0-9_]+/g)?.[0];
  if (unresolved) {
    throw new Error(`Missing path param ${unresolved.slice(1)} for route ${key}`);
  }
  if (!query || typeof query !== 'object' || Array.isArray(query)) return resolvedPath;

  const values = new URLSearchParams();
  for (const [queryKey, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    values.set(queryKey, String(value));
  }
  const encoded = values.toString();
  return encoded ? `${resolvedPath}?${encoded}` : resolvedPath;
}
