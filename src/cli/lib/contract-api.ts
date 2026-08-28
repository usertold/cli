import {
  buildDashboardApiPath,
  dashboardApiContracts,
  type DashboardApiContractEntry,
  type DashboardApiContractKey,
  type DashboardApiPathParams,
  type DashboardApiQuery,
  type DashboardApiRequestBody,
  type DashboardApiResponse,
} from '../../shared/api-contracts';
import type { AuthMode, RequestRetryOptions } from './http';
import { requestBinary, requestFormDataJson, requestJson, requestText } from './http';
import { buildProjectApiPathFromRef, requireCanonicalProjectRef } from './project-ref';
import type { CliEnvironment } from './types';

type DashboardProjectScopedContractKey = {
  [K in DashboardApiContractKey]:
    DashboardApiContractEntry<K>['path'] extends `${string}:orgHandle${string}:projectHandle${string}`
      ? K
      : never;
}[DashboardApiContractKey];

type DashboardProjectRouteParams<K extends DashboardProjectScopedContractKey> =
  Omit<DashboardApiPathParams<K>, 'orgHandle' | 'projectHandle'>;

type ContractApiSharedRequestOptions = {
  authMode?: AuthMode;
  projectKey?: string;
  headers?: Record<string, string>;
  retryOptions?: RequestRetryOptions;
};

type ContractApiQueryInput<K extends DashboardApiContractKey> =
  DashboardApiQuery<K> | Record<string, string | number | boolean | null | undefined>;
type ContractApiBodyInput<K extends DashboardApiContractKey> =
  DashboardApiRequestBody<K> | Record<string, unknown>;

export type ContractApiDefaults = ContractApiSharedRequestOptions & {
  env: CliEnvironment;
};

export type ContractApiRequestOptions<K extends DashboardApiContractKey> =
  ContractApiSharedRequestOptions & {
    pathParams?: DashboardApiPathParams<K>;
    query?: ContractApiQueryInput<K>;
    body?: ContractApiBodyInput<K>;
  };

export type ProjectScopedContractApiRequestOptions<K extends DashboardProjectScopedContractKey> =
  ContractApiSharedRequestOptions & {
    pathParams?: DashboardProjectRouteParams<K>;
    query?: ContractApiQueryInput<K>;
    body?: ContractApiBodyInput<K>;
  };

export type RequestProjectContractOptions<K extends DashboardProjectScopedContractKey> =
  ProjectScopedContractApiRequestOptions<K> & {
    env: CliEnvironment;
    key: K;
    projectRef: string;
    sourceLabel?: string;
  };

export type RequestContractOptions<K extends DashboardApiContractKey> =
  ContractApiRequestOptions<K> & {
    env: CliEnvironment;
    key: K;
  };

export function createContractApi(defaults: ContractApiDefaults) {
  return {
    path<K extends DashboardApiContractKey>(
      key: K,
      pathParams?: DashboardApiPathParams<K>,
      query?: DashboardApiQuery<K>,
    ): string {
      return buildDashboardApiPath(key, pathParams, query);
    },

    request<K extends DashboardApiContractKey>(
      key: K,
      options: ContractApiRequestOptions<K> = {},
    ): Promise<DashboardApiResponse<K>> {
      return doRequestContract(defaults, key, options);
    },
  };
}

export function createProjectScopedContractApi(
  defaults: ContractApiDefaults & { projectRef: string },
) {
  const project = requireCanonicalProjectRef(defaults.projectRef, 'projectRef');

  return {
    path<K extends DashboardProjectScopedContractKey>(
      key: K,
      pathParams?: DashboardProjectRouteParams<K>,
      query?: DashboardApiQuery<K>,
    ): string {
      const scopedPathParams = {
        ...pathParams,
        orgHandle: project.orgHandle,
        projectHandle: project.projectHandle,
      } as DashboardApiPathParams<K>;

      return buildDashboardApiPath(key, scopedPathParams, query);
    },

    request<K extends DashboardProjectScopedContractKey>(
      key: K,
      options: ProjectScopedContractApiRequestOptions<K> = {},
    ): Promise<DashboardApiResponse<K>> {
      const scopedPathParams = {
        ...options.pathParams,
        orgHandle: project.orgHandle,
        projectHandle: project.projectHandle,
      } as DashboardApiPathParams<K>;

      return doRequestContract(defaults, key, {
        ...options,
        pathParams: scopedPathParams,
      });
    },
  };
}

export function requestContract<K extends DashboardApiContractKey>(
  options: RequestContractOptions<K>,
): Promise<DashboardApiResponse<K>> {
  return doRequestContract({ env: options.env }, options.key, options);
}

export function requestContractJson<K extends DashboardApiContractKey>(
  key: K,
  options: Omit<RequestContractOptions<K>, 'key'>,
): Promise<DashboardApiResponse<K>> {
  return requestContract({ ...options, key });
}

export function requestProjectContract<K extends DashboardProjectScopedContractKey>(
  options: RequestProjectContractOptions<K>,
): Promise<DashboardApiResponse<K>> {
  const project = requireCanonicalProjectRef(options.projectRef, options.sourceLabel ?? '<projectRef>');
  const scopedPathParams = {
    ...options.pathParams,
    orgHandle: project.orgHandle,
    projectHandle: project.projectHandle,
  } as DashboardApiPathParams<K>;

  const requestOptions: ContractApiRequestOptions<K> = {
    pathParams: scopedPathParams,
    query: options.query,
    body: options.body,
    authMode: options.authMode,
    projectKey: options.projectKey,
    headers: options.headers,
    retryOptions: options.retryOptions,
  };

  return doRequestContract({ env: options.env }, options.key, {
    ...requestOptions,
  });
}

export function requestProjectContractJson<K extends DashboardProjectScopedContractKey>(
  key: K,
  options: Omit<RequestProjectContractOptions<K>, 'key'>,
): Promise<DashboardApiResponse<K>> {
  return requestProjectContract({ ...options, key });
}

export async function requestContractText<K extends DashboardApiContractKey>(
  key: K,
  options: Omit<RequestContractOptions<K>, 'key'>,
): Promise<string | null> {
  return requestText({
    env: options.env,
    method: dashboardApiContracts[key].method,
    path: buildDashboardApiPath(key, options.pathParams, options.query),
    authMode: options.authMode,
    projectKey: options.projectKey,
    headers: options.headers,
  });
}

export async function requestContractBinary<K extends DashboardApiContractKey>(
  key: K,
  options: Omit<RequestContractOptions<K>, 'key'>,
): Promise<Buffer> {
  return requestBinary({
    env: options.env,
    method: dashboardApiContracts[key].method,
    path: buildDashboardApiPath(key, options.pathParams, options.query),
    authMode: options.authMode,
    projectKey: options.projectKey,
    headers: options.headers,
  });
}

export async function requestProjectContractText<K extends DashboardProjectScopedContractKey>(
  key: K,
  options: Omit<RequestProjectContractOptions<K>, 'key'>,
): Promise<string | null> {
  const project = requireCanonicalProjectRef(options.projectRef, options.sourceLabel ?? '<projectRef>');
  const scopedPathParams = {
    ...options.pathParams,
    orgHandle: project.orgHandle,
    projectHandle: project.projectHandle,
  } as DashboardApiPathParams<K>;

  return requestContractText(key, {
    ...options,
    pathParams: scopedPathParams,
  });
}

export async function requestProjectContractBinary<K extends DashboardProjectScopedContractKey>(
  key: K,
  options: Omit<RequestProjectContractOptions<K>, 'key'>,
): Promise<Buffer> {
  const project = requireCanonicalProjectRef(options.projectRef, options.sourceLabel ?? '<projectRef>');
  const scopedPathParams = {
    ...options.pathParams,
    orgHandle: project.orgHandle,
    projectHandle: project.projectHandle,
  } as DashboardApiPathParams<K>;

  return requestContractBinary(key, {
    ...options,
    pathParams: scopedPathParams,
  });
}

export async function requestProjectContractFormDataJson<K extends DashboardProjectScopedContractKey>(
  key: K,
  options: Omit<RequestProjectContractOptions<K>, 'key' | 'body'> & { formData: FormData },
): Promise<DashboardApiResponse<K>> {
  const project = requireCanonicalProjectRef(options.projectRef, options.sourceLabel ?? '<projectRef>');
  const scopedPathParams = {
    ...options.pathParams,
    orgHandle: project.orgHandle,
    projectHandle: project.projectHandle,
  } as DashboardApiPathParams<K>;

  return requestFormDataJson<DashboardApiResponse<K>>({
    env: options.env,
    method: dashboardApiContracts[key].method,
    path: buildDashboardApiPath(key, scopedPathParams, options.query),
    authMode: options.authMode,
    projectKey: options.projectKey,
    headers: options.headers,
    formData: options.formData,
  }, options.retryOptions);
}

type ProjectPathRequestOptions = {
  env: CliEnvironment;
  projectRef: string;
  path: string;
  method: string;
  sourceLabel?: string;
  body?: unknown;
  authMode?: AuthMode;
  projectKey?: string;
  headers?: Record<string, string>;
};

export async function requestProjectPathJson<T = unknown>(options: ProjectPathRequestOptions): Promise<T> {
  return requestJson<T>({
    env: options.env,
    method: options.method,
    path: buildProjectApiPathFromRef(options.projectRef, options.path, options.sourceLabel ?? '<projectRef>'),
    body: options.body,
    authMode: options.authMode,
    projectKey: options.projectKey,
    headers: options.headers,
  });
}

export async function requestProjectPathText(options: ProjectPathRequestOptions): Promise<string | null> {
  return requestText({
    env: options.env,
    method: options.method,
    path: buildProjectApiPathFromRef(options.projectRef, options.path, options.sourceLabel ?? '<projectRef>'),
    authMode: options.authMode,
    projectKey: options.projectKey,
    headers: options.headers,
  });
}

export async function requestProjectPathBinary(options: ProjectPathRequestOptions): Promise<Buffer> {
  return requestBinary({
    env: options.env,
    method: options.method,
    path: buildProjectApiPathFromRef(options.projectRef, options.path, options.sourceLabel ?? '<projectRef>'),
    authMode: options.authMode,
    projectKey: options.projectKey,
    headers: options.headers,
  });
}

async function doRequestContract<K extends DashboardApiContractKey>(
  defaults: ContractApiDefaults,
  key: K,
  options: ContractApiRequestOptions<K>,
): Promise<DashboardApiResponse<K>> {
  return requestJson<DashboardApiResponse<K>>({
    env: defaults.env,
    method: dashboardApiContracts[key].method,
    path: buildDashboardApiPath(key, options.pathParams, options.query),
    body: options.body,
    authMode: options.authMode ?? defaults.authMode,
    projectKey: options.projectKey ?? defaults.projectKey,
    headers: mergeHeaders(defaults.headers, options.headers),
  }, options.retryOptions);
}

function mergeHeaders(
  defaults?: Record<string, string>,
  overrides?: Record<string, string>,
): Record<string, string> | undefined {
  if (!defaults && !overrides) {
    return undefined;
  }
  return {
    ...defaults,
    ...overrides,
  };
}
