export const BILLING_EVENT_TYPES = {
  balanceOpening: 'balance.opening',
  balancePurchased: 'balance.purchased',
  balanceBonus: 'balance.bonus',
  balanceRoundingAdjustment: 'balance.rounding_adjustment',
  balancePurchaseRefunded: 'balance.purchase_refunded',
  interviewQuoted: 'interview.quoted',
  interviewCharged: 'interview.charged',
  interviewRefunded: 'interview.refunded',
} as const;

export type BillingEventType = typeof BILLING_EVENT_TYPES[keyof typeof BILLING_EVENT_TYPES];

export const BILLING_EVENT_DISPLAY_KINDS = ['purchase', 'bonus', 'usage', 'refund', 'opening', 'other'] as const;
export type BillingEventDisplayKind = typeof BILLING_EVENT_DISPLAY_KINDS[number];

export const BILLING_EVENT_AMOUNT_DIRECTIONS = ['credit', 'debit', 'neutral'] as const;
export type BillingEventAmountDirection = typeof BILLING_EVENT_AMOUNT_DIRECTIONS[number];

export interface BillingEventDisplaySemantics {
  label: string;
  kind: BillingEventDisplayKind;
  amountDirection: BillingEventAmountDirection;
}

export function getBillingEventDisplaySemantics(eventType: string): BillingEventDisplaySemantics {
  switch (eventType) {
    case BILLING_EVENT_TYPES.balanceOpening:
      return { label: 'Opening balance', kind: 'opening', amountDirection: 'credit' };
    case BILLING_EVENT_TYPES.balancePurchased:
      return { label: 'Balance purchase', kind: 'purchase', amountDirection: 'credit' };
    case BILLING_EVENT_TYPES.balanceBonus:
      return { label: 'Bonus balance', kind: 'bonus', amountDirection: 'credit' };
    case BILLING_EVENT_TYPES.balanceRoundingAdjustment:
      return { label: 'Balance rounding adjustment', kind: 'bonus', amountDirection: 'credit' };
    case BILLING_EVENT_TYPES.balancePurchaseRefunded:
      return { label: 'Balance purchase refund', kind: 'refund', amountDirection: 'debit' };
    case BILLING_EVENT_TYPES.interviewCharged:
      return { label: 'Interview', kind: 'usage', amountDirection: 'debit' };
    case BILLING_EVENT_TYPES.interviewRefunded:
      return { label: 'Interview refund', kind: 'refund', amountDirection: 'credit' };
    case BILLING_EVENT_TYPES.interviewQuoted:
      return { label: 'Interview quote', kind: 'other', amountDirection: 'neutral' };
    default:
      return { label: eventType, kind: 'other', amountDirection: 'neutral' };
  }
}

export function getSignedBillingAmountCents(_eventType: string, balanceDeltaCents: number): number {
  return balanceDeltaCents;
}
