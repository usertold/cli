export const INTERVIEW_ARTIFACT_KINDS = [
  'transcript_text',
  'transcript_vtt',
  'audio',
  'screen',
  'events',
] as const;

export const INTERVIEW_ARTIFACT_AVAILABILITIES = [
  'available',
  'processing',
  'interrupted',
  'not_recorded',
  'messages_only',
  'missing',
] as const;

export type InterviewArtifactKind = typeof INTERVIEW_ARTIFACT_KINDS[number];
export type InterviewArtifactAvailability = typeof INTERVIEW_ARTIFACT_AVAILABILITIES[number];

export type InterviewArtifact = {
  kind: InterviewArtifactKind;
  availability: InterviewArtifactAvailability;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadUrl: string | null;
  expiresAt: string | null;
};

export type InterviewArtifactManifest = {
  interviewRef: string;
  artifacts: InterviewArtifact[];
};
