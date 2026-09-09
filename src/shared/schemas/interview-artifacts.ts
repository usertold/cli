import { z } from 'zod';
import {
  INTERVIEW_ARTIFACT_AVAILABILITIES,
  INTERVIEW_ARTIFACT_KINDS,
} from '../interview-artifacts';

export const InterviewArtifactSchema = z.object({
  kind: z.enum(INTERVIEW_ARTIFACT_KINDS),
  availability: z.enum(INTERVIEW_ARTIFACT_AVAILABILITIES),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  downloadUrl: z.string().url().nullable(),
  expiresAt: z.string().nullable(),
});

export const InterviewArtifactManifestSchema = z.object({
  interviewRef: z.string(),
  artifacts: z.array(InterviewArtifactSchema).length(INTERVIEW_ARTIFACT_KINDS.length),
});
