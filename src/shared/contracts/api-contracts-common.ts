import { type z } from 'zod';

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

type BodyContract<TBody extends z.ZodTypeAny | undefined> = TBody;
type QueryContract<TQuery extends z.ZodTypeAny | undefined> = TQuery;

export interface DashboardApiAdditionalResponse<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  description: string;
  schema: TSchema;
}

type ResponseContract = Record<number, DashboardApiAdditionalResponse>;

export interface DashboardApiContract<
  TMethod extends HttpMethod,
  TPath extends string,
  TBody extends z.ZodTypeAny | undefined = undefined,
  TQuery extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TPathParams extends readonly string[] = readonly [],
  TResponses extends ResponseContract | undefined = undefined,
> {
  method: TMethod;
  path: TPath;
  pathParams: TPathParams;
  body?: BodyContract<TBody>;
  query?: QueryContract<TQuery>;
  response: TResponseSchema;
  responses?: TResponses;
}

export function defineContract<
  TMethod extends HttpMethod,
  TPath extends string,
  TBody extends z.ZodTypeAny | undefined,
  TQuery extends z.ZodTypeAny | undefined,
  TResponseSchema extends z.ZodTypeAny,
  TPathParams extends readonly string[],
  TResponses extends ResponseContract | undefined,
>(contract: DashboardApiContract<TMethod, TPath, TBody, TQuery, TResponseSchema, TPathParams, TResponses>) {
  return contract;
}
