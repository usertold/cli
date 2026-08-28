export const QUESTION_TYPES = ['text', 'textarea', 'single_choice', 'multiple_choice', 'number', 'rating'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

export const LEGACY_STUDY_TYPES = ['jtbd', 'usability', 'exploration', 'custom'] as const;
export type LegacyStudyType = typeof LEGACY_STUDY_TYPES[number];

export function isLegacyStudyType(value: string): value is LegacyStudyType {
  return (LEGACY_STUDY_TYPES as readonly string[]).includes(value);
}

export const STUDY_STATUSES = ['draft', 'active', 'paused', 'closed'] as const;
export type StudyStatus = typeof STUDY_STATUSES[number];

export function isStudyStatus(value: string): value is StudyStatus {
  return (STUDY_STATUSES as readonly string[]).includes(value);
}

export const INCENTIVE_TYPES = ['none', 'gift_card'] as const;
export type IncentiveType = typeof INCENTIVE_TYPES[number];

export const SESSION_STATUSES = ['pending', 'active', 'completed', 'abandoned', 'error'] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];

export type TerminalSessionStatus = Extract<SessionStatus, 'completed' | 'abandoned' | 'error'>;

export const TERMINAL_SESSION_STATUSES: readonly TerminalSessionStatus[] = ['completed', 'abandoned', 'error'];

export function isSessionStatus(value: string): value is SessionStatus {
  return (SESSION_STATUSES as readonly string[]).includes(value);
}

export const INTERVIEW_MODES = ['voice', 'text', 'async'] as const;
export type InterviewMode = typeof INTERVIEW_MODES[number];

export function isInterviewMode(value: string): value is InterviewMode {
  return (INTERVIEW_MODES as readonly string[]).includes(value);
}

/**
 * Prepaid balance amounts available for purchase.
 * Each pack is a one-time Polar product. polar_product_id must match Polar dashboard.
 */
export interface BalancePack {
  dollars: number;
  cents: number;
  label: string;
  polar_product_id: string;
}

const PACK_BASES = [
  { dollars: 10,  cents: 1000,  label: '$10 balance'  },
  { dollars: 30,  cents: 3000,  label: '$30 balance'  },
  { dollars: 50,  cents: 5000,  label: '$50 balance'  },
  { dollars: 100, cents: 10000, label: '$100 balance' },
] as const;

// Only the Polar product IDs differ between environments.
const POLAR_IDS: Record<'production' | 'stage', Record<number, string>> = {
  production: {
    10:  '40075ec1-64dd-48c5-bf52-dfc9cf0cb2cd',
    30:  '9a9bc44e-619d-44e8-bdb4-6e7abb8e6fbb',
    50:  '90743041-471a-4945-a6ae-22ebb50eea4a',
    100: '10976ec0-6750-400a-943e-11ec2e11c1c1',
  },
  stage: {
    10:  'c35b13eb-4ffc-492e-ae58-0d10d26893ee',
    30:  'bf902d6b-34b7-401c-8174-f624abd9dfa4',
    50:  'fad94220-062d-4729-b4d4-2bea4466837c',
    100: '2dd93069-e8fe-41b1-a433-8de69e3f00de',
  },
};

export function getBalancePacks(environment?: string): BalancePack[] {
  const ids = POLAR_IDS[environment === 'production' ? 'production' : 'stage'];
  return PACK_BASES.map(p => ({ ...p, polar_product_id: ids[p.dollars] }));
}

/** Display-only alias (amounts and labels are identical across environments). */
export const BALANCE_PACKS = getBalancePacks('production');

/**
 * Free Managed AI allowance, in cents — the starting prepaid balance given to
 * a NEW account. Override per environment with the
 * `FREE_PLATFORM_ALLOWANCE_CENTS` var.
 */
export const FREE_PLATFORM_ALLOWANCE_CENTS = 200;

export function readFreePlatformAllowanceCents(env?: { FREE_PLATFORM_ALLOWANCE_CENTS?: string }): number {
  const raw = env?.FREE_PLATFORM_ALLOWANCE_CENTS;
  if (!raw) return FREE_PLATFORM_ALLOWANCE_CENTS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : FREE_PLATFORM_ALLOWANCE_CENTS;
}
