import { z } from 'zod';
import { INTERVIEW_MODES, SESSION_STATUSES } from './constants';
import { TARGET_SURFACE_FILTERS, TARGET_SURFACES } from './target-surface';
import {
  hasControlCharacters,
  USER_DISPLAY_NAME_MAX_LENGTH,
  validateWorkspaceHandle,
  validateWorkspaceName,
  WORKSPACE_HANDLE_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from './validation';
import {
  CanonicalPlacementPathnameSchema,
  RECRUITMENT_REFERENCE_PATTERN,
  StudyInvitationSchema,
  StudyVisibilitySchema,
} from './study-placement';
import { SUPPORTED_WIDGET_LOCALES } from './widget-locales';

// ============================================================================
// Shared API Request Contracts — Zod schemas are the single source of truth.
// Types are derived via z.infer<>.
// ============================================================================

// --- Projects ---

export const ApiProjectCreateRequestSchema = z.object({
  name: z.string(),
  handle: z.string().optional(),
  description: z.string().nullable().optional(),
}).strict();
export type ApiProjectCreateRequest = z.infer<typeof ApiProjectCreateRequestSchema>;

export const ApiProjectPatchRequestSchema = ApiProjectCreateRequestSchema.partial();
export type ApiProjectPatchRequest = z.infer<typeof ApiProjectPatchRequestSchema>;

// --- Organizations ---

export const ApiOrganizationCreateRequestSchema = z.object({
  orgHandle: z.string()
    .max(WORKSPACE_HANDLE_MAX_LENGTH)
    .refine((value) => validateWorkspaceHandle(value) === null, 'Workspace handle is invalid'),
  orgName: z.string()
    .max(WORKSPACE_NAME_MAX_LENGTH)
    .refine((value) => validateWorkspaceName(value) === null, 'Organization name is invalid'),
});
export type ApiOrganizationCreateRequest = z.infer<typeof ApiOrganizationCreateRequestSchema>;

export const ApiOrganizationParticipantUpdateRequestSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
  projectAccess: z.discriminatedUnion('scope', [
    z.object({ scope: z.literal('all') }).strict(),
    z.object({ scope: z.literal('selected'), projectIds: z.array(z.string()).max(500) }).strict(),
  ]),
}).strict();
export type ApiOrganizationParticipantUpdateRequest = z.infer<typeof ApiOrganizationParticipantUpdateRequestSchema>;

export const ApiOrganizationInvitationCreateRequestSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['owner', 'admin', 'member']),
  projectAccess: z.discriminatedUnion('scope', [
    z.object({ scope: z.literal('all') }).strict(),
    z.object({ scope: z.literal('selected'), projectIds: z.array(z.string()).max(500) }).strict(),
  ]),
}).strict();

export const ApiOrganizationProjectShareRequestSchema = z.object({
  email: z.string().email().max(254),
}).strict();

export const ApiOrganizationInvitationTokenRequestSchema = z.object({
  token: z.string().min(32).max(512),
}).strict();

export const ApiOrganizationInvitationAcceptRequestSchema = ApiOrganizationInvitationTokenRequestSchema.extend({
  organizationHandle: z.string().min(1),
}).strict();

// --- Signals ---

export const ApiSessionSignalCreateRequestSchema = z.object({
  signal_type: z.string(),
  target_surface: z.enum(TARGET_SURFACES).optional(),
  quote: z.string(),
  observed_facts: z.array(z.string()).optional(),
  headline: z.string().optional(),
  claim: z.string().optional(),
  reconstruction: z.string().optional(),
  timestamp_ms: z.number().optional(),
  page_url: z.string().optional(),
  page_title: z.string().optional(),
  preceding_actions: z.array(z.string()).optional(),
  user_goal: z.string().optional(),
  outcome: z.string().optional(),
}).strict().superRefine((signal, ctx) => {
  if (!signal.quote.trim() && !signal.observed_facts?.some((fact) => fact.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quote'],
      message: 'Evidence requires a participant quote or at least one observed fact',
    });
  }
});
export type ApiSessionSignalCreateRequest = z.infer<typeof ApiSessionSignalCreateRequestSchema>;

export const ApiSignalPatchRequestSchema = z.object({
  signal_type: z.string().optional(),
  target_surface: z.enum(TARGET_SURFACES).nullable().optional(),
  confidence: z.number().optional(),
  intensity: z.number().nullable().optional(),
  quote: z.string().optional(),
  timestamp_ms: z.number().nullable().optional(),
  page_url: z.string().nullable().optional(),
  page_title: z.string().nullable().optional(),
  preceding_actions: z.array(z.string()).nullable().optional(),
  user_goal: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  claim: z.string().nullable().optional(),
  reconstruction: z.string().nullable().optional(),
  observed_facts: z.array(z.string()).nullable().optional(),
}).strict();
export type ApiSignalPatchRequest = z.infer<typeof ApiSignalPatchRequestSchema>;

export const ApiSignalAnnotateRequestSchema = z.object({
  text: z.string().optional(),
});
export type ApiSignalAnnotateRequest = z.infer<typeof ApiSignalAnnotateRequestSchema>;

export const ApiSignalDismissRequestSchema = z.object({
  reason: z.string().optional(),
});
export type ApiSignalDismissRequest = z.infer<typeof ApiSignalDismissRequestSchema>;

export const ApiSignalReviewRequestSchema = z.object({
  status: z.enum(['needs_review', 'published', 'dismissed']),
  note: z.string().optional(),
});
export type ApiSignalReviewRequest = z.infer<typeof ApiSignalReviewRequestSchema>;

export const ApiSignalLinkRequestSchema = z.object({
  task_id: z.string(),
});
export type ApiSignalLinkRequest = z.infer<typeof ApiSignalLinkRequestSchema>;

export const ApiSignalBulkLinkRequestSchema = z.object({
  signal_ids: z.array(z.string()).min(1),
  task_id: z.string(),
});
export type ApiSignalBulkLinkRequest = z.infer<typeof ApiSignalBulkLinkRequestSchema>;

export const ApiSignalBulkDeleteRequestSchema = z.object({
  signal_ids: z.array(z.string()).min(1),
});
export type ApiSignalBulkDeleteRequest = z.infer<typeof ApiSignalBulkDeleteRequestSchema>;

export const ApiSignalListQuerySchema = z.object({
  type: z.string().optional(),
  target_surface: z.enum(TARGET_SURFACE_FILTERS).optional(),
  session_id: z.string().optional(),
  task_id: z.string().optional(),
  search: z.string().optional(),
  min_confidence: z.string().optional(),
  dismissed: z.string().optional(),
  include_closed: z.string().optional(),
  review_status: z.string().optional(),
  review_state: z.enum(['active', 'needs_review', 'active_linked', 'active_unlinked', 'possible_recurrence', 'resolved']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// --- Intake ---

export const intakeQuestionBaseSchema = z.object({
  question_text: z.string(),
  question_type: z.string(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  min_value: z.number().optional(),
  max_value: z.number().optional(),
  qualification_rules: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type ApiIntakeQuestionPayload = z.infer<typeof intakeQuestionBaseSchema>;

export const ApiIntakeQuestionCreateRequestSchema = intakeQuestionBaseSchema;
export type ApiIntakeQuestionCreateRequest = z.infer<typeof ApiIntakeQuestionCreateRequestSchema>;

export const ApiIntakeQuestionPatchRequestSchema = intakeQuestionBaseSchema.partial();
export type ApiIntakeQuestionPatchRequest = z.infer<typeof ApiIntakeQuestionPatchRequestSchema>;

export const ApiIntakeQuestionReorderRequestSchema = z.object({
  question_ids: z.array(z.string()),
});
export type ApiIntakeQuestionReorderRequest = z.infer<typeof ApiIntakeQuestionReorderRequestSchema>;

export const ApiIntakeSetQuestionsRequestSchema = z.object({
  questions: z.array(intakeQuestionBaseSchema),
});
export type ApiIntakeSetQuestionsRequest = z.infer<typeof ApiIntakeSetQuestionsRequestSchema>;

export const ApiIntakeResponseSubmitRequestSchema = z.object({
  participant_name: z.string().optional(),
  participant_email: z.string().optional(),
  answers: z.record(z.string(), z.unknown()),
  consent_given: z.boolean().optional(),
  consent_recording: z.boolean().optional(),
  consent_analytics: z.boolean().optional(),
  consent_followup: z.boolean().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});
export type ApiIntakeResponseSubmitRequest = z.infer<typeof ApiIntakeResponseSubmitRequestSchema>;

export const ApiIntakeResponsePatchRequestSchema = z.object({
  qualified: z.boolean(),
  reason: z.string().optional(),
});
export type ApiIntakeResponsePatchRequest = z.infer<typeof ApiIntakeResponsePatchRequestSchema>;

export const ApiIntakeCreateRequestSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  handle: z.string().optional(),
  welcome_message: z.string().nullable().optional(),
  brand_color: z.string().optional(),
  consent_text: z.string().optional(),
  max_participants: z.number().optional(),
  questions: z.array(intakeQuestionBaseSchema).optional(),
});
export type ApiIntakeCreateRequest = z.infer<typeof ApiIntakeCreateRequestSchema>;

export const ApiIntakePatchRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  handle: z.string().optional(),
  status: z.string().optional(),
  auto_managed: z.number().optional(),
  max_participants: z.number().optional(),
  logo_r2_key: z.string().nullable().optional(),
  brand_color: z.string().optional(),
  welcome_message: z.string().nullable().optional(),
  thank_you_message: z.string().nullable().optional(),
  disqualified_message: z.string().nullable().optional(),
  consent_text: z.string().optional(),
});
export type ApiIntakePatchRequest = z.infer<typeof ApiIntakePatchRequestSchema>;

// --- Settings ---

export const ApiProjectSettingsUpdateRequestSchema = z.record(z.string(), z.string());
export type ApiProjectSettingsUpdateRequest = z.infer<typeof ApiProjectSettingsUpdateRequestSchema>;

export const ApiProjectSettingsValidateRequestSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type ApiProjectSettingsValidateRequest = z.infer<typeof ApiProjectSettingsValidateRequestSchema>;

export const ApiKnowledgeActionConfigInputSchema = z.object({
  name: z.string().min(1).max(120),
  when_to_use: z.string().min(1).max(1_000),
  method: z.enum(['GET', 'POST']),
  url: z.string().min(1).max(2_000),
  headers: z.record(z.string(), z.string().nullable()).default({}),
  body: z.record(z.string(), z.unknown()).nullable().optional(),
  response_path: z.string().max(500).nullable().optional(),
});
export type ApiKnowledgeActionConfigInput = z.infer<typeof ApiKnowledgeActionConfigInputSchema>;

export const ApiKnowledgeActionTestRequestSchema = z.object({
  query: z.string().min(1).max(500),
  page_url: z.string().max(2_000).optional(),
  site_hostname: z.string().max(253).optional(),
  action: ApiKnowledgeActionConfigInputSchema.optional(),
});
export type ApiKnowledgeActionTestRequest = z.infer<typeof ApiKnowledgeActionTestRequestSchema>;

// --- Studies ---

export const ApiStudyCreateRequestSchema = z.object({
  title: z.string(),
  handle: z.string().optional(),
  description: z.string().nullable().optional(),
  goals: z.unknown().optional(),
  script: z.unknown().optional(),
  settings: z.unknown().optional(),
  invitation: StudyInvitationSchema.nullable().optional(),
  visibility: StudyVisibilitySchema.nullable().optional(),
  allowed_selectors: z.array(z.string()).optional(),
  allowed_origins: z.array(z.string()).optional(),
  intake_ref: z.string().nullable().optional(),
  auto_create_intake: z.boolean().optional(),
}).strict();
export type ApiStudyCreateRequest = z.infer<typeof ApiStudyCreateRequestSchema>;

export const ApiStudyPatchRequestSchema = ApiStudyCreateRequestSchema.partial().extend({
  status: z.string().optional(),
});
export type ApiStudyPatchRequest = z.infer<typeof ApiStudyPatchRequestSchema>;

export const ApiStudyPlacementContextSchema = z.object({
  pathname: CanonicalPlacementPathnameSchema,
  language: z.enum(SUPPORTED_WIDGET_LOCALES).nullable().optional(),
}).strict();

export const ApiStudyPlacementPreviewRequestSchema = ApiStudyPlacementContextSchema.extend({
  arrival: z.enum(['placement', 'direct_link']).optional(),
  override: z.object({
    study_ref: z.string().min(1),
    invitation: StudyInvitationSchema.nullable(),
    visibility: StudyVisibilitySchema.nullable(),
  }).strict().optional(),
}).strict();
export type ApiStudyPlacementPreviewRequest = z.infer<typeof ApiStudyPlacementPreviewRequestSchema>;

export const ApiStudyReviewScriptRequestSchema = z.object({
  script: z.unknown().optional(),
});
export type ApiStudyReviewScriptRequest = z.infer<typeof ApiStudyReviewScriptRequestSchema>;

// --- Sessions ---

export const ApiSessionListQuerySchema = z.object({
  status: z.enum(SESSION_STATUSES).optional(),
  study_ref: z.string().optional(),
  processing_status: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
}).strict();
export type ApiSessionListQuery = z.infer<typeof ApiSessionListQuerySchema>;

export const ApiSessionCreateRequestSchema = z.object({
  participant_name: z.string().nullable().optional(),
  participant_email: z.string().nullable().optional(),
  interview_mode: z.string().optional(),
  intake_response_id: z.string().optional(),
});
export type ApiSessionCreateRequest = z.infer<typeof ApiSessionCreateRequestSchema>;

export const ApiSessionPatchRequestSchema = z.object({
  status: z.enum(SESSION_STATUSES).optional(),
  current_phase: z.string().nullable().optional(),
  phase_started_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  duration_seconds: z.number().optional(),
  participant_name: z.string().nullable().optional(),
  participant_email: z.string().nullable().optional(),
  interview_mode: z.string().optional(),
  consent_recording: z.number().optional(),
  consent_analytics: z.number().optional(),
  consent_followup: z.number().optional(),
  summary: z.string().nullable().optional(),
  intake_response_id: z.string().optional(),
});
export type ApiSessionPatchRequest = z.infer<typeof ApiSessionPatchRequestSchema>;

export const ApiSessionReprocessQuerySchema = z.object({
  replace_manual_evidence: z.string().optional(),
});
export type ApiSessionReprocessQuery = z.infer<typeof ApiSessionReprocessQuerySchema>;

export const ApiSessionMessageRequestSchema = z.object({
  role: z.string(),
  content: z.string(),
  timestamp_ms: z.number().optional(),
  audio_chunk_key: z.string().optional(),
  idempotency_key: z.string().optional(),
});
export type ApiSessionMessageRequest = z.infer<typeof ApiSessionMessageRequestSchema>;

export const ApiSessionEventRequestSchema = z.object({
  event_type: z.string(),
  timestamp_ms: z.number().optional(),
  event_line: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type ApiSessionEventRequest = z.infer<typeof ApiSessionEventRequestSchema>;

export const ApiSessionProcessingStatusRequestSchema = z.object({
  session_ids: z.array(z.string()),
});
export type ApiSessionProcessingStatusRequest = z.infer<typeof ApiSessionProcessingStatusRequestSchema>;

// --- User ---

export const ApiUserProfileUpdateRequestSchema = z.object({
  name: z.string()
    .max(USER_DISPLAY_NAME_MAX_LENGTH)
    .refine((value) => !hasControlCharacters(value), 'Name cannot include control characters')
    .optional(),
});
export type ApiUserProfileUpdateRequest = z.infer<typeof ApiUserProfileUpdateRequestSchema>;

export const ApiEmailNotificationPreferencesUpdateRequestSchema = z.object({
  research: z.boolean(),
  credits: z.boolean(),
  integrations: z.boolean(),
});
export type ApiEmailNotificationPreferencesUpdateRequest = z.infer<
  typeof ApiEmailNotificationPreferencesUpdateRequestSchema
>;

export const ApiUserLastVisitedOrgRequestSchema = z.object({
  handle: z.string()
    .max(WORKSPACE_HANDLE_MAX_LENGTH)
    .refine((value) => validateWorkspaceHandle(value) === null, 'Workspace handle is invalid'),
});
export type ApiUserLastVisitedOrgRequest = z.infer<typeof ApiUserLastVisitedOrgRequestSchema>;

// --- Auth ---

export const ApiAuthOnboardingRequestSchema = z.object({
  acceptTerms: z.boolean(),
  personalOrgHandle: z.string()
    .max(WORKSPACE_HANDLE_MAX_LENGTH)
    .refine((value) => validateWorkspaceHandle(value) === null, 'Workspace handle is invalid')
    .optional(),
  personalOrgName: z.string()
    .max(WORKSPACE_NAME_MAX_LENGTH)
    .refine((value) => validateWorkspaceName(value) === null, 'Organization name is invalid')
    .optional(),
});
export type ApiAuthOnboardingRequest = z.infer<typeof ApiAuthOnboardingRequestSchema>;

const PasswordEmailSchema = z.string().trim().pipe(z.email().max(254));

export const ApiPasswordLoginRequestSchema = z.object({
  email: PasswordEmailSchema,
  password: z.string().max(4096),
}).strict();
export type ApiPasswordLoginRequest = z.infer<typeof ApiPasswordLoginRequestSchema>;

export const ApiPasswordSetupRequestSchema = z.object({
  email: PasswordEmailSchema,
  returnTo: z.string().max(2048).optional(),
}).strict();
export type ApiPasswordSetupRequest = z.infer<typeof ApiPasswordSetupRequestSchema>;

export const ApiPasswordRegistrationRequestSchema = z.object({
  displayName: z.string().max(USER_DISPLAY_NAME_MAX_LENGTH),
  email: PasswordEmailSchema,
  password: z.string().max(4096),
  passwordConfirmation: z.string().max(4096),
  acceptTerms: z.literal(true),
  turnstileToken: z.string().min(1).max(2048),
  invitationToken: z.string().min(32).max(512).optional(),
}).strict();
export type ApiPasswordRegistrationRequest = z.infer<typeof ApiPasswordRegistrationRequestSchema>;

export const ApiPasswordVerificationRequestSchema = z.object({
  token: z.string().min(32).max(256),
}).strict();
export type ApiPasswordVerificationRequest = z.infer<typeof ApiPasswordVerificationRequestSchema>;

export const ApiPasswordVerificationEmailChangeRequestSchema = z.object({
  email: PasswordEmailSchema,
}).strict();
export type ApiPasswordVerificationEmailChangeRequest = z.infer<typeof ApiPasswordVerificationEmailChangeRequestSchema>;

export const ApiPasswordSetupCompleteRequestSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z.string().max(4096),
  displayName: z.string().max(USER_DISPLAY_NAME_MAX_LENGTH).optional(),
}).strict();
export type ApiPasswordSetupCompleteRequest = z.infer<typeof ApiPasswordSetupCompleteRequestSchema>;

export const ApiPasswordChangeRequestSchema = z.object({
  currentPassword: z.string().max(4096),
  newPassword: z.string().max(4096),
}).strict();
export type ApiPasswordChangeRequest = z.infer<typeof ApiPasswordChangeRequestSchema>;

export const ApiOAuthApprovalDecisionRequestSchema = z.object({
  requestId: z.string(),
  approved: z.boolean(),
});
export type ApiOAuthApprovalDecisionRequest = z.infer<typeof ApiOAuthApprovalDecisionRequestSchema>;

export const ApiOAuthDynamicClientRegistrationRequestSchema = z.object({
  client_name: z.string().optional(),
  redirect_uris: z.array(z.string()).min(1),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  scope: z.string().optional(),
  token_endpoint_auth_method: z.enum(['none', 'client_secret_post', 'client_secret_basic']).optional(),
}).meta({ id: 'ApiOAuthDynamicClientRegistrationRequest' });
export type ApiOAuthDynamicClientRegistrationRequest = z.infer<typeof ApiOAuthDynamicClientRegistrationRequestSchema>;

// --- GitHub App ---

export const ApiGitHubAppSelectInstallationRequestSchema = z.object({
  installation_id: z.string(),
});
export type ApiGitHubAppSelectInstallationRequest = z.infer<typeof ApiGitHubAppSelectInstallationRequestSchema>;

export const ApiGitHubAppSelectRepoRequestSchema = z.object({
  repo_url: z.string(),
  default_branch: z.string().optional(),
});
export type ApiGitHubAppSelectRepoRequest = z.infer<typeof ApiGitHubAppSelectRepoRequestSchema>;

// --- SDK ---

export const ApiSdkSessionCreateRequestSchema = z.object({
  participant_name: z.string().optional(),
  participant_email: z.string().optional(),
  interview_mode: z.enum(INTERVIEW_MODES).optional(),
  study_ref: z.string().min(1),
});

export const ApiSdkWidgetBootstrapRequestSchema = z.object({
  study_ref: z.string().min(1),
}).strict();
export type ApiSdkWidgetBootstrapRequest = z.infer<typeof ApiSdkWidgetBootstrapRequestSchema>;

export const ApiSdkWidgetDirectLinkRequestSchema = z.object({
  recruitment_ref: z.string().regex(RECRUITMENT_REFERENCE_PATTERN),
}).strict();
export type ApiSdkWidgetDirectLinkRequest = z.infer<typeof ApiSdkWidgetDirectLinkRequestSchema>;

export const ApiWidgetInstallationVerificationRequestSchema = z.object({
  url: z.string().trim().url().max(2048),
}).strict();
export type ApiWidgetInstallationVerificationRequest = z.infer<typeof ApiWidgetInstallationVerificationRequestSchema>;

export const ApiSdkSessionConsentRequestSchema = z.object({
  consent_copy_version: z.string().min(1).max(64),
});
export type ApiSdkSessionConsentRequest = z.infer<typeof ApiSdkSessionConsentRequestSchema>;

export const ApiSdkUploadStartRequestSchema = z.object({
  session_id: z.string(),
});

export const ApiSdkUploadFinalizeRequestSchema = z.object({
  session_id: z.string(),
});
export type ApiSdkUploadFinalizeRequest = z.infer<typeof ApiSdkUploadFinalizeRequestSchema>;

export const ApiSdkRecordingHealthReportRequestSchema = z.object({
  status: z.enum(['recovering_integrity', 'degraded', 'recovered']),
  stream: z.enum(['audio', 'screen']),
  sequence: z.number().int().nonnegative(),
  attempts: z.number().int().positive(),
  retryable: z.boolean(),
  message: z.string(),
  http_status: z.number().int().optional(),
  error_code: z.string().optional(),
});
export type ApiSdkRecordingHealthReportRequest = z.infer<typeof ApiSdkRecordingHealthReportRequestSchema>;

export const ApiConductorCheckpointRequestSchema = z.object({
  trigger: z.enum(['pagehide', 'beforeunload']),
  recorder_state: z.enum(['idle', 'ready', 'recording', 'paused', 'stopped', 'error']).nullable().optional(),
  transition: z.object({
    id: z.string(),
    source: z.enum(['study_navigation', 'page_reload']),
    fromUrl: z.string(),
    fromTitle: z.string().optional(),
    targetUrl: z.string().optional(),
    ts: z.number(),
  }).optional(),
  // Widget telemetry events that must land even if the WS is mid-reconnect at
  // unload time. The checkpoint API uses sendBeacon / fetch keepalive, so it
  // survives page death; the WS queue does not. The DO persists each entry to
  // session_events as event_type=`widget.<name>`. Capped to keep beacon
  // payloads small — the only intended caller is the STS navigation
  // terminator, but the array shape leaves room for adjacent terminators
  // (e.g. tts_turn_completed) without another schema change.
  widget_events: z.array(z.object({
    name: z.string().min(1).max(64),
    ts: z.number(),
    data: z.record(z.string(), z.unknown()),
  })).max(8).optional(),
  // Participant STS transcripts that were still inside the short
  // cross-source dedupe window when the document exited. Unlike the WS queue,
  // this keepalive checkpoint survives navigation; capture provenance keeps
  // the server from attaching a delayed turn to the resumed segment.
  transcripts: z.array(z.object({
    role: z.literal('user'),
    text: z.string().min(1).max(8_000),
    ts: z.number(),
    source: z.literal('sts_fallback'),
    capture_segment_id: z.string().min(1).max(200),
    capture_epoch: z.number().int().positive(),
    transport_id: z.string().min(1).max(128),
  })).max(8).optional(),
  // Final browser STT usage interval harvested during page teardown. The
  // client does not choose the billing connection id; ConductorDO derives it
  // from the checkpoint id and applies the same elapsed-time clamp as WS usage.
  transcription_usage: z.object({
    sequence: z.number().int().nonnegative(),
    audioSeconds: z.number().positive(),
    keySourceToken: z.string().min(1).optional(),
  }).optional(),
});
export type ApiConductorCheckpointRequest = z.infer<typeof ApiConductorCheckpointRequestSchema>;

export const ApiConductorSTSSecretRequestSchema = z.object({
  segment_id: z.string().min(1).optional(),
});
export type ApiConductorSTSSecretRequest = z.infer<typeof ApiConductorSTSSecretRequestSchema>;

export const ApiConductorRealtimeCallRequestSchema = z.object({
  sdp: z.string().min(1),
});
export type ApiConductorRealtimeCallRequest = z.infer<typeof ApiConductorRealtimeCallRequestSchema>;

export type { SessionStatus, InterviewMode } from './constants';

// ============================================================================
// Shared API Response Types — re-exported from Zod schemas in src/shared/schemas/
// ============================================================================

export type {
  // Common
  ApiSuccessResponse, ApiErrorResponse,
  // Projects
  ApiProject,
  ApiProjectsListResponse, ApiProjectDetailResponse, ApiProjectMutationResponse, ApiProjectSignalHealthResponse,
  ApiCoverageGapType, ApiCoverageGapRow, ApiProjectCoverageGapsResponse,
  // Sessions
  ApiSession, ApiInterviewState, ApiSessionMessage, ApiSessionEvent, ApiAudioChunk,
  ApiScreenChunkEntry, ApiScreenManifest, ApiSessionCue,
  ApiSessionsListResponse, ApiSessionDetailResponse, ApiSessionMutationResponse,
  ApiSessionUploadVideoResponse, ApiMediaUploadInitiateResponse, ApiMediaUploadPartUrlResponse,
  ApiSessionMessageResponse, ApiSessionCuesResponse,
  ApiProcessingStatus, ApiBatchProcessingStatusResponse,
  ApiSessionReprocessResponse, ApiSessionRetryTranscriptionResponse,
  ApiSessionRetryFailedTranscriptionResponse,
  ApiEnrichedTimelineEntry,
  // Signals
  ApiSignal, ApiSignalsListResponse, ApiSignalResponse, ApiSignalBulkMutationResponse,
  // Tasks
  ApiTask, ApiTaskRecurrenceCandidate, ApiProviderState,
  ApiTasksListResponse, ApiTaskDetailResponse, ApiTaskResponse,
  ApiTaskProviderStateResponse, ApiReadyTasksResponse,
  ApiTaskCreateFromSignalsResponse, ApiTaskRecurrenceCandidateResponse,
  // Screeners
  ApiIntake, ApiIntakeQuestion, ApiIntakeResponse,
  ApiIntakesListResponse, ApiIntakeDetailResponse, ApiIntakeResponseWrapper,
  ApiIntakeCreateResponse, ApiIntakeQuestionResponse, ApiIntakeQuestionsReorderResponse,
  // Studies
  ApiStudy, ApiStudiesListResponse, ApiStudyResponse, ApiStudyUpdateResponse, ApiStudyReviewScriptResponse,
  // Auth
  ApiAuthSessionUser, ApiUserProfile, ApiUserProfileUpdateResponse,
  ApiAuthSessionResponse, ApiAuthLogoutResponse,
  ApiAuthOnboardingCompleteResponse, ApiAuthRevokeOlderSessionsResponse,
  ApiOAuthGrant, ApiOAuthGrantListResponse, ApiOAuthGrantRevokeResponse, ApiOAuthGrantRevokeAllResponse,
  ApiOAuthDiscoveryResponse, ApiJwksResponse,
  ApiOAuthApprovalRequestResponse, ApiOAuthApprovalDecisionResponse,
  ApiOAuthDynamicClientRegistrationResponse,
  // Billing
  ApiBillingEvent, ApiBillingProjectMode, ApiBillingStatus, ApiBillingEventsResponse, ApiBillingCheckoutResponse,
  ApiBillingInterview, ApiBillingInterviewsResponse,
  // Settings
  ApiProjectSettingsResponse, ApiProjectSettingsKeyHealthResponse, ApiValidationResponse,
  ApiGitHubRepo, ApiGitHubReposResponse, ApiGitHubSelectRepoResponse, ApiGitHubHealthResponse,
  // Overview
  ApiOverviewResponse,
} from './schemas';

// --- Types not in schemas (kept inline) ---

export type ApiSessionProcessingStatusFilter = 'failed' | 'done';

/** GET /api/oauth/authorize/request */
export interface ApiOAuthApprovalRequestParams extends Record<
  string,
  string | number | boolean | null | undefined
> {
  request: string;
}

/** GET /api/oauth/authorize/request — error variant */
export interface ApiOAuthApprovalRequestErrorResponse {
  error: string;
  code?: string;
  needs_onboarding?: boolean;
  needs_terms_acceptance?: boolean;
  needs_org_handle_review?: boolean;
  onboarding_path?: string;
  oauth_client?: string;
  oauth_client_name?: string;
}

// --- Billing request schemas ---

export const ApiBillingCheckoutRequestSchema = z.object({
  success_url: z.string().optional(),
  pack: z.number().optional(),
});
export type ApiBillingCheckoutRequest = z.infer<typeof ApiBillingCheckoutRequestSchema>;

export const ApiBillingEventsQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});
export type ApiBillingEventsQuery = z.infer<typeof ApiBillingEventsQuerySchema>;

export const ApiAdminBalanceGrantRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  amount_cents: z.number().int().positive().max(10_000_000),
  reason: z.string().trim().min(1).max(160),
  grant_id: z.string().trim().min(1).max(160).optional(),
});
export type ApiAdminBalanceGrantRequest = z.infer<typeof ApiAdminBalanceGrantRequestSchema>;

export const ApiAdminInterviewRefundRequestSchema = z.object({
  session_id: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(160),
});
export type ApiAdminInterviewRefundRequest = z.infer<typeof ApiAdminInterviewRefundRequestSchema>;

// --- Admin: auth.md trust list (agent providers) ---

const HttpsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((v) => {
    try {
      const url = new URL(v);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, { message: 'must be an https URL' });

const AgentProviderStatusSchema = z.enum(['active', 'disabled']);

export const ApiAdminAgentProviderCreateRequestSchema = z.object({
  issuer: HttpsUrlSchema,
  display_name: z.string().trim().min(1).max(160),
  jwks_uri: HttpsUrlSchema,
  allowed_audiences: z.array(HttpsUrlSchema).min(1),
  status: AgentProviderStatusSchema.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type ApiAdminAgentProviderCreateRequest = z.infer<typeof ApiAdminAgentProviderCreateRequestSchema>;

// --- Admin: outbound email test ---

export const ApiAdminEmailTestRequestSchema = z.object({
  to: z.string().trim().email().optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
});
export type ApiAdminEmailTestRequest = z.infer<typeof ApiAdminEmailTestRequestSchema>;

export const ApiAdminAgentProviderUpdateRequestSchema = z.object({
  display_name: z.string().trim().min(1).max(160).optional(),
  jwks_uri: HttpsUrlSchema.optional(),
  allowed_audiences: z.array(HttpsUrlSchema).min(1).optional(),
  status: AgentProviderStatusSchema.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine((v) => Object.values(v).some((x) => x !== undefined), {
  message: 'at least one field must be provided',
});
export type ApiAdminAgentProviderUpdateRequest = z.infer<typeof ApiAdminAgentProviderUpdateRequestSchema>;

// --- Webhook responses (not in contracts, kept inline) ---

export interface ApiGitHubWebhookIgnoredResponse {
  ignored: boolean;
  reason?: string;
}

export interface ApiPolarWebhookAckResponse {
  received: boolean;
  duplicate?: boolean;
}

// --- Guard responses ---

export interface ApiInsufficientCreditsResponse {
  code: 'INSUFFICIENT_CREDITS';
}

export interface ApiKeysRequiredResponse {
  code: 'API_KEYS_REQUIRED';
}
