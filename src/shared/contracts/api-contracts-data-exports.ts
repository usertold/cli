import { z } from 'zod';
import { defineContract } from './api-contracts-common';

export const ApiDataExportJobSchema = z.object({
  id: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  requested_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  expires_at: z.string(),
  download_url: z.string().nullable(),
  error_message: z.string().nullable(),
});

export const ApiDataExportCreateResponseSchema = z.object({
  job: ApiDataExportJobSchema,
  media_url_ttl_seconds: z.number(),
}).meta({ id: 'ApiDataExportCreateResponse' });

export const ApiDataExportListResponseSchema = z.object({
  jobs: z.array(ApiDataExportJobSchema),
  media_url_ttl_seconds: z.number(),
});

export const dataExportApiContracts = {
  dataExportCreate: defineContract({
    method: 'POST',
    path: '/api/user/data-exports',
    pathParams: [],
    response: ApiDataExportCreateResponseSchema,
  }),
  dataExportList: defineContract({
    method: 'GET',
    path: '/api/user/data-exports',
    pathParams: [],
    response: ApiDataExportListResponseSchema,
  }),
  dataExportGet: defineContract({
    method: 'GET',
    path: '/api/user/data-exports/:jobId',
    pathParams: ['jobId'],
    response: ApiDataExportCreateResponseSchema,
  }),
  dataExportDownload: defineContract({
    method: 'GET',
    path: '/api/user/data-exports/:jobId/download',
    pathParams: ['jobId'],
    response: z.unknown(),
  }),
} as const;
