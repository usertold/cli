import { z } from 'zod';

export const ApiSuccessResponseSchema = z.object({
  success: z.boolean(),
}).meta({ id: 'ApiSuccessResponse' });
export type ApiSuccessResponse = z.infer<typeof ApiSuccessResponseSchema>;

export const ApiPurgeResponseSchema = z.object({
  success: z.boolean(),
  d1RowsDeleted: z.number(),
  r2ObjectsDeleted: z.number(),
}).meta({ id: 'ApiPurgeResponse' });
export type ApiPurgeResponse = z.infer<typeof ApiPurgeResponseSchema>;

export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  retryable: z.boolean().optional(),
  action: z.string().optional(),
  requestId: z.string().optional(),
}).meta({ id: 'ApiErrorResponse' });
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
