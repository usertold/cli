import { type z } from 'zod';
export * from './contracts/api-contracts-common';
import { billingApiContracts } from './contracts/api-contracts-billing';
import { dataExportApiContracts } from './contracts/api-contracts-data-exports';
import { overviewApiContracts } from './contracts/api-contracts-overview';
import { projectsApiContracts } from './contracts/api-contracts-projects';
import { intakesApiContracts } from './contracts/api-contracts-intakes';
import { sessionsApiContracts } from './contracts/api-contracts-sessions';
import { settingsApiContracts } from './contracts/api-contracts-settings';
import { signalsApiContracts } from './contracts/api-contracts-signals';
import { studiesApiContracts } from './contracts/api-contracts-studies';
import { findingsApiContracts } from './contracts/api-contracts-findings';
import { userApiContracts } from './contracts/api-contracts-user';

export const dashboardApiContracts = {
  ...userApiContracts,
  ...dataExportApiContracts,
  ...projectsApiContracts,
  ...sessionsApiContracts,
  ...signalsApiContracts,
  ...findingsApiContracts,
  ...intakesApiContracts,
  ...studiesApiContracts,
  ...overviewApiContracts,
  ...settingsApiContracts,
  ...billingApiContracts,
} as const;

type DashboardApiContractCatalog = typeof dashboardApiContracts;
type DashboardApiContractValue = DashboardApiContractCatalog[keyof DashboardApiContractCatalog];
export type DashboardApiContractKey = Extract<keyof DashboardApiContractCatalog, string>;
export type DashboardApiContractPath = Extract<DashboardApiContractValue['path'], string>;

type DashboardApiContractEntryByPath<K extends DashboardApiContractPath> = {
  [ContractKey in DashboardApiContractKey]:
    DashboardApiContractCatalog[ContractKey]['path'] extends K
    ? DashboardApiContractCatalog[ContractKey]
    : never;
}[DashboardApiContractKey];

export type DashboardApiContractKeyOrPath = DashboardApiContractKey | DashboardApiContractPath;

export type DashboardApiContractEntry<K extends DashboardApiContractKeyOrPath> = K extends DashboardApiContractKey
  ? DashboardApiContractCatalog[K]
  : DashboardApiContractEntryByPath<Extract<K, DashboardApiContractPath>>;

type DashboardApiShape<T extends z.ZodTypeAny | undefined> = T extends z.ZodObject<infer Shape, infer _Config>
  ? OptionalizeUndefined<{
      [K in keyof Shape]: z.input<Shape[K]>;
    }>
  : z.input<NonNullable<T>>;

type KeysWithUndefined<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];
type KeysWithoutUndefined<T> = Exclude<keyof T, KeysWithUndefined<T>>;

type OptionalizeUndefined<T extends object> = {
  [K in KeysWithoutUndefined<T>]: T[K];
} & {
  [K in KeysWithUndefined<T>]?: Exclude<T[K], undefined>;
};

export type DashboardApiPathParams<K extends DashboardApiContractKeyOrPath> = {
  [P in DashboardApiContractEntry<K>['pathParams'][number]]: string;
};

export type DashboardApiRequestBody<K extends DashboardApiContractKeyOrPath> =
  DashboardApiShape<DashboardApiContractEntry<K>['body']>;

export type DashboardApiQuery<K extends DashboardApiContractKeyOrPath> =
  DashboardApiShape<DashboardApiContractEntry<K>['query']>;

export type DashboardApiResponse<K extends DashboardApiContractKeyOrPath> = z.output<
  DashboardApiContractEntry<K>['response']
>;

export function buildDashboardApiPath<K extends DashboardApiContractKey>(
  key: K,
  params?: DashboardApiPathParams<K>,
  query?: Record<string, string | number | boolean | null | undefined> | DashboardApiQuery<K>,
): string;
export function buildDashboardApiPath<K extends DashboardApiContractPath>(
  path: K,
  params?: DashboardApiPathParams<K>,
  query?: Record<string, string | number | boolean | null | undefined> | DashboardApiQuery<K>,
): string;
export function buildDashboardApiPath(
  keyOrPath: DashboardApiContractKeyOrPath,
  params: Record<string, string> = {},
  query?: Record<string, string | number | boolean | null | undefined> | DashboardApiQuery<DashboardApiContractKeyOrPath>,
): string {
  const meta = dashboardApiContracts[keyOrPath as DashboardApiContractKey]
    ?? Object.values(dashboardApiContracts).find((entry) => entry.path === keyOrPath);
  if (!meta) throw new Error(`Unknown public API route ${keyOrPath}`);

  let resolvedPath: string = meta.path;
  for (const [param, value] of Object.entries(params)) {
    resolvedPath = resolvedPath.replaceAll(`:${param}`, encodeURIComponent(String(value)));
  }

  const unresolved = resolvedPath.match(/:[a-zA-Z0-9_]+/g)?.[0];
  if (unresolved) {
    throw new Error(`Missing path param ${unresolved.slice(1)} for route ${keyOrPath}`);
  }
  if (!query) return resolvedPath;

  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    values.set(key, String(value));
  }
  const encoded = values.toString();
  return encoded ? `${resolvedPath}?${encoded}` : resolvedPath;
}
