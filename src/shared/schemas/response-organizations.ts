import { z } from 'zod';

export const ApiOrganizationSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  role: z.string(),
  createdAt: z.string(),
});
export type ApiOrganization = z.infer<typeof ApiOrganizationSchema>;

export const ApiOrganizationsListResponseSchema = z.object({
  organizations: z.array(ApiOrganizationSchema),
});
export type ApiOrganizationsListResponse = z.infer<typeof ApiOrganizationsListResponseSchema>;

export const organizationsListResponse = ApiOrganizationsListResponseSchema;

export const ApiOrganizationMutationResponseSchema = z.object({
  organization: ApiOrganizationSchema,
});
export type ApiOrganizationMutationResponse = z.infer<typeof ApiOrganizationMutationResponseSchema>;

export const ApiManagedOrganizationProjectSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
});
export type ApiManagedOrganizationProject = z.infer<typeof ApiManagedOrganizationProjectSchema>;

export const ApiOrganizationParticipantSchema = z.object({
  userId: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['owner', 'admin', 'member']),
  projectAccess: z.object({
    scope: z.enum(['all', 'selected']),
    projects: z.array(ApiManagedOrganizationProjectSchema),
  }),
});
export type ApiOrganizationParticipant = z.infer<typeof ApiOrganizationParticipantSchema>;

export const ApiOrganizationParticipantsListResponseSchema = z.object({
  participants: z.array(ApiOrganizationParticipantSchema),
  projects: z.array(ApiManagedOrganizationProjectSchema),
});
export type ApiOrganizationParticipantsListResponse = z.infer<typeof ApiOrganizationParticipantsListResponseSchema>;

export const ApiOrganizationParticipantMutationResponseSchema = z.object({
  participant: ApiOrganizationParticipantSchema,
});
export type ApiOrganizationParticipantMutationResponse = z.infer<typeof ApiOrganizationParticipantMutationResponseSchema>;

export const ApiOrganizationParticipantRemoveResponseSchema = z.object({
  removed: z.literal(true),
});
export type ApiOrganizationParticipantRemoveResponse = z.infer<typeof ApiOrganizationParticipantRemoveResponseSchema>;

export const ApiOrganizationInvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['owner', 'admin', 'member']),
  projectAccess: z.object({
    scope: z.enum(['all', 'selected']),
    projectIds: z.array(z.string()),
  }),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type ApiOrganizationInvitation = z.infer<typeof ApiOrganizationInvitationSchema>;

export const ApiOrganizationInvitationMutationResponseSchema = z.object({
  invitation: ApiOrganizationInvitationSchema.optional(),
  participant: ApiOrganizationParticipantSchema.optional(),
  emailed: z.boolean(),
});
export type ApiOrganizationInvitationMutationResponse = z.infer<typeof ApiOrganizationInvitationMutationResponseSchema>;

export const ApiOrganizationInvitationsListResponseSchema = z.object({
  invitations: z.array(ApiOrganizationInvitationSchema),
});
export type ApiOrganizationInvitationsListResponse = z.infer<typeof ApiOrganizationInvitationsListResponseSchema>;

export const ApiOrganizationInvitationInspectResponseSchema = z.object({
  invitation: ApiOrganizationInvitationSchema.extend({
    organization: z.object({ handle: z.string(), name: z.string() }),
  }).nullable(),
});
export type ApiOrganizationInvitationInspectResponse = z.infer<typeof ApiOrganizationInvitationInspectResponseSchema>;

export const ApiOrganizationInvitationActionResponseSchema = z.object({ accepted: z.literal(true) });
export const ApiOrganizationInvitationRevokeResponseSchema = z.object({ revoked: z.literal(true) });
export const ApiOrganizationInvitationResendResponseSchema = z.object({ accepted: z.literal(true) });
