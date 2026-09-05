export const FINDING_RESEARCH_STATES = ['draft', 'reviewed', 'closed'] as const;
export type FindingResearchState = (typeof FINDING_RESEARCH_STATES)[number];

export const FINDING_DELIVERY_STATES = [
  'not_sent',
  'sending',
  'awaiting_product_triage',
  'accepted',
  'in_progress',
  'completed',
  'declined',
  'duplicate',
  'failed',
] as const;
export type FindingDeliveryState = (typeof FINDING_DELIVERY_STATES)[number];

export const LINEAR_PROVIDER_PLACEMENTS = ['triage', 'backlog_fallback'] as const;
export type LinearProviderPlacement = (typeof LINEAR_PROVIDER_PLACEMENTS)[number];
