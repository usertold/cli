import { z } from 'zod';
import { pickWidgetLocale, SUPPORTED_WIDGET_LOCALES, type WidgetLocale } from './widget-locales';
import {
  INVITATION_CORNERS,
  INVITATION_ICONS,
  INVITATION_PRESENTATION_MODES,
  INVITATION_REWARD_KINDS,
  type StudyInvitation,
} from './study-invitation';
import { generateEntityId } from './id';
import { validateAllowedOrigins } from './allowed-origins';
export { DEFAULT_STUDY_INVITATION, INVITATION_CORNERS, INVITATION_ICONS, INVITATION_PRESENTATION_MODES, INVITATION_REWARD_KINDS, type StudyInvitation } from './study-invitation';

export const VISIBILITY_MATCHES = ['exact', 'subtree'] as const;
export const VISIBILITY_EFFECTS = ['include', 'exclude'] as const;
export const CANONICAL_PLACEMENT_PATHNAME_PATTERN = '^/(?!/)(?!.*//)(?!.*[?#\\\\])(?=[\\x21-\\x7E]*$)(?!.*["<>^`{}])(?!(?:.*\\/)?(?:\\.|%2[eE]){1,2}(?:\\/|$))(?:$|.*[^/])$';
export const DEFAULT_STUDY_VISIBILITY = {
  version: 1,
  enabled: true,
  rules: [],
  priority: 0,
  order: 0,
} as const satisfies StudyVisibility;

export const RECRUITMENT_REFERENCE_PATTERN = /^rct_[0-9a-z]{24}$/;
export const StudyRecruitmentCampaignSchema = z.object({
  reference: z.string().regex(RECRUITMENT_REFERENCE_PATTERN),
}).strict();
export type StudyRecruitmentCampaign = z.infer<typeof StudyRecruitmentCampaignSchema>;

export function parseStudySettings(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch { return {}; }
}

const HexColorSchema = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a six-digit hex color')
  .transform((value) => value.toLowerCase());

export const StudyInvitationSchema = z.object({
  launcher: z.object({
    label: z.string().trim().min(1).max(80),
    icon: z.enum(INVITATION_ICONS),
  }).strict(),
  panel: z.object({
    eyebrow: z.string().trim().min(1).max(80).optional(),
    headline: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(600).optional(),
    duration_minutes: z.number().int().min(1).max(240).optional(),
    reward: z.object({
      kind: z.enum(INVITATION_REWARD_KINDS),
      label: z.string().trim().min(1).max(160),
      eligibility: z.string().trim().min(1).max(240).optional(),
      delivery: z.string().trim().min(1).max(240).optional(),
    }).strict().optional(),
    cta: z.string().trim().min(1).max(80),
    image: z.object({
      asset_id: z.string().trim().min(1).max(160),
      url: z.string().url().max(2_000).refine((value) => new URL(value).protocol === 'https:', 'Managed image URL must use HTTPS'),
      alt: z.string().trim().max(160),
    }).strict().optional(),
  }).strict().optional(),
  presentation_mode: z.enum(INVITATION_PRESENTATION_MODES),
  brand_color: z.object({
    light: HexColorSchema,
    dark: HexColorSchema.optional(),
  }).strict(),
  placement: z.object({
    desktop: z.enum(INVITATION_CORNERS),
    mobile: z.enum(INVITATION_CORNERS),
  }).strict(),
}).strict().superRefine((invitation, ctx) => {
  if (invitation.presentation_mode !== 'passive' && !invitation.panel) {
    ctx.addIssue({ code: 'custom', path: ['panel'], message: 'Contextual and direct-link Invitations require a panel' });
  }
});

export const CanonicalPlacementPathnameSchema = z.string().min(1).max(2_000)
  .regex(new RegExp(CANONICAL_PLACEMENT_PATHNAME_PATTERN), 'Pathname must use canonical URL path characters')
  .refine((value) => value.startsWith('/') && !value.startsWith('//'), 'Pathname must start with one /')
  .refine((value) => !value.includes('?') && !value.includes('#'), 'Pathname must not contain query or hash')
  .refine((value) => !value.includes('\\') && !value.slice(1).includes('//'), 'Pathname must not contain backslashes or repeated slashes')
  .refine((value) => value === '/' || !value.endsWith('/'), 'Pathname must not have a trailing slash')
  .refine((value) => {
    try { return new URL(value, 'https://placement.invalid').pathname === value; } catch { return false; }
  }, 'Pathname must be canonical and must not contain dot segments');

export const StudyVisibilityRuleSchema = z.object({
  effect: z.enum(VISIBILITY_EFFECTS),
  match: z.enum(VISIBILITY_MATCHES),
  pathname: CanonicalPlacementPathnameSchema,
}).strict();
export type StudyVisibilityRule = z.infer<typeof StudyVisibilityRuleSchema>;

const PlacementLanguageSchema = z.string()
  .transform((value, ctx) => {
    const locale = normalizePlacementLanguage(value);
    if (!locale) {
      ctx.addIssue({ code: 'custom', message: `Unsupported widget language. Use: ${SUPPORTED_WIDGET_LOCALES.join(', ')}` });
      return z.NEVER;
    }
    return locale;
  });

export const StudyVisibilitySchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  rules: z.array(StudyVisibilityRuleSchema).max(100).default([]),
  languages: z.array(PlacementLanguageSchema).max(20)
    .transform((values) => {
      const unique = [...new Set(values)];
      return unique.length ? unique : undefined;
    })
    .optional(),
  priority: z.number().int().min(-1_000_000).max(1_000_000).default(0),
  order: z.number().int().min(0).max(1_000_000).default(0),
}).strict();

export type StudyVisibility = z.infer<typeof StudyVisibilitySchema>;

export interface StudyPlacementCandidate {
  study_ref: string;
  visibility: StudyVisibility;
}

export type StudyPlacementResolution =
  | { outcome: 'match'; study_ref: string }
  | { outcome: 'no_match' }
  | { outcome: 'ambiguous'; study_refs: string[] };

export interface StudyPlacementAnalysis {
  resolution: StudyPlacementResolution;
  matching_study_refs: string[];
  ambiguity_context_key?: string;
}

export interface StudyPlacementAmbiguity {
  context_key?: string;
  study_refs: string[];
  pathname: string;
  synthetic_pathname: boolean;
  synthetic_root?: string;
  language: WidgetLocale;
}

export interface StudyPlacementCandidateSetAnalysis {
  ambiguities: StudyPlacementAmbiguity[];
  matching_study_refs: string[];
  winning_study_refs: string[];
}

export interface StudyPlacementWinnerContext {
  study_ref: string;
  pathname: string;
  synthetic_pathname: boolean;
  synthetic_root?: string;
  language: WidgetLocale;
}

const MAX_PLACEMENT_PATHNAME_LENGTH = 2_000;
const PLACEMENT_PROBE_SEGMENT_ALPHABET = "!$%&'()*+,-.0123456789:;=@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]_abcdefghijklmnopqrstuvwxyz|~";

export function normalizeVisibilityPathname(value: string): string {
  const trimmed = value.trim();
  let pathname = trimmed;
  try {
    pathname = new URL(trimmed, 'https://placement.invalid').pathname;
  } catch {
    pathname = trimmed.split(/[?#]/, 1)[0];
  }
  pathname = `/${pathname}`.replace(/\/{2,}/g, '/');
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
  return pathname;
}

export function normalizePlacementLanguage(value: string | null | undefined): string | null {
  return pickWidgetLocale(value);
}

export function pathnameMatches(rulePathname: string, pathname: string, match: 'exact' | 'subtree'): boolean {
  const rule = normalizeVisibilityPathname(rulePathname);
  const target = normalizeVisibilityPathname(pathname);
  if (match === 'exact') return target === rule;
  return rule === '/' || target === rule || target.startsWith(`${rule}/`);
}

export function resolveStudyPlacement(
  candidates: readonly StudyPlacementCandidate[],
  input: { pathname: string; language?: string | null },
): StudyPlacementResolution {
  return compileStudyPlacementCandidates(candidates)(input).resolution;
}

/**
 * Validate and normalize a candidate set once, then resolve many page/language
 * contexts without reparsing every rule. The dashboard uses the matching refs
 * to explain conflicts; the widget consumes only the final resolution.
 */
export function compileStudyPlacementCandidates(
  candidates: readonly StudyPlacementCandidate[],
): (input: { pathname: string; language?: string | null }) => StudyPlacementAnalysis {
  const compiled = candidates.flatMap((candidate) => {
    const visibility = StudyVisibilitySchema.safeParse(candidate.visibility);
    if (!visibility.success || !visibility.data.enabled) return [];
    const includeRules = visibility.data.rules.filter((rule) => rule.effect === 'include');
    const excludeRules = visibility.data.rules.filter((rule) => rule.effect === 'exclude');
    return [{
      candidate,
      visibility: visibility.data,
      hasIncludes: includeRules.length > 0,
      exactIncludes: new Set(includeRules.filter((rule) => rule.match === 'exact').map((rule) => rule.pathname)),
      subtreeIncludes: new Set(includeRules.filter((rule) => rule.match === 'subtree').map((rule) => rule.pathname)),
      exactExcludes: new Set(excludeRules.filter((rule) => rule.match === 'exact').map((rule) => rule.pathname)),
      subtreeExcludes: new Set(excludeRules.filter((rule) => rule.match === 'subtree').map((rule) => rule.pathname)),
    }];
  });

  return (input) => {
    const pathname = normalizeVisibilityPathname(input.pathname);
    const language = normalizePlacementLanguage(input.language);
    const pathPrefixes = canonicalPathPrefixes(pathname);
    const matches = compiled.flatMap(({
      candidate,
      visibility,
      hasIncludes,
      exactIncludes,
      subtreeIncludes,
      exactExcludes,
      subtreeExcludes,
    }) => {
      if (visibility.languages?.length && (!language || !visibility.languages.includes(language))) return [];
      if (exactExcludes.has(pathname) || pathPrefixes.some((prefix) => subtreeExcludes.has(prefix))) return [];
      let matchingSubtree: string | undefined;
      for (const prefix of pathPrefixes) {
        if (subtreeIncludes.has(prefix)) matchingSubtree = prefix;
      }
      const pathSpecificity = exactIncludes.has(pathname)
        ? pathname.length * 2 + 1
        : matchingSubtree
          ? matchingSubtree.length * 2
          : 0;
      if (hasIncludes && pathSpecificity === 0) return [];
      const pathContext = exactIncludes.has(pathname)
        ? `exact:${pathname}`
        : matchingSubtree
          ? `subtree:${matchingSubtree}`
          : 'all';
      return [{
        candidate,
        visibility,
        specificity: pathSpecificity * 2 + (visibility.languages?.length ? 1 : 0),
        contextKey: `${candidate.study_ref}:${pathContext}:${visibility.languages?.join(',') ?? 'all'}`,
      }];
    });
    const matchingStudyRefs = matches.map((match) => match.candidate.study_ref);
    if (matches.length === 0) {
      return { resolution: { outcome: 'no_match' }, matching_study_refs: matchingStudyRefs };
    }
    matches.sort((a, b) => (
      b.specificity - a.specificity
      || b.visibility.priority - a.visibility.priority
      || a.visibility.order - b.visibility.order
    ));
    const winner = matches[0];
    const tied = matches.filter((item) => (
      item.specificity === winner.specificity
      && item.visibility.priority === winner.visibility.priority
      && item.visibility.order === winner.visibility.order
    ));
    const resolution: StudyPlacementResolution = tied.length > 1
      ? { outcome: 'ambiguous', study_refs: tied.map((item) => item.candidate.study_ref).sort() }
      : { outcome: 'match', study_ref: winner.candidate.study_ref };
    return {
      resolution,
      matching_study_refs: matchingStudyRefs,
      ...(tied.length > 1
        ? { ambiguity_context_key: tied.map((item) => item.contextKey).sort().join('\u0000') }
        : {}),
    };
  };
}

/**
 * Exhaustively analyze the finite path/language equivalence classes induced by
 * a candidate set. This is shared by the dashboard diagnostics and the
 * authenticated mutation guard so both surfaces agree on exact ambiguities.
 */
export function analyzeStudyPlacementCandidateSet(
  candidates: readonly StudyPlacementCandidate[],
): StudyPlacementCandidateSetAnalysis {
  const pathnames = buildPlacementProbePathnames(candidates);
  const languages = buildPlacementProbeLanguages(candidates);
  const resolvePlacement = compileStudyPlacementCandidates(candidates);
  const ambiguitiesByContext = new Map<string, StudyPlacementAmbiguity>();
  const matchingStudyRefs = new Set<string>();
  const winningStudyRefs = new Set<string>();

  for (const language of languages) {
    for (const { pathname, synthetic, syntheticRoot } of pathnames) {
      const analysis = resolvePlacement({ pathname, language });
      for (const studyRef of analysis.matching_study_refs) matchingStudyRefs.add(studyRef);
      if (analysis.resolution.outcome === 'match') winningStudyRefs.add(analysis.resolution.study_ref);
      if (analysis.resolution.outcome !== 'ambiguous') continue;
      const key = analysis.ambiguity_context_key
        ?? `${analysis.resolution.study_refs.join('\u0000')}\u0001${pathname}`;
      if (!ambiguitiesByContext.has(key)) {
        ambiguitiesByContext.set(key, {
          study_refs: analysis.resolution.study_refs,
          pathname,
          synthetic_pathname: synthetic,
          ...(syntheticRoot !== undefined ? { synthetic_root: syntheticRoot } : {}),
          language,
        });
      }
    }
  }

  return {
    ambiguities: [...ambiguitiesByContext.values()],
    matching_study_refs: [...matchingStudyRefs],
    winning_study_refs: [...winningStudyRefs],
  };
}

/**
 * Compare the same finite path/language universe before and after a mutation.
 * A pre-existing ambiguity may be preserved or reduced during repair; a new
 * ambiguity or a tie that introduces another Study is rejected.
 */
export function findIntroducedStudyPlacementAmbiguities(
  beforeCandidates: readonly StudyPlacementCandidate[],
  afterCandidates: readonly StudyPlacementCandidate[],
): StudyPlacementAmbiguity[] {
  const combined = [...beforeCandidates, ...afterCandidates];
  const pathnames = buildPlacementProbePathnames(combined);
  const languages = buildPlacementProbeLanguages(combined);
  const resolveBefore = compileStudyPlacementCandidates(beforeCandidates);
  const resolveAfter = compileStudyPlacementCandidates(afterCandidates);
  const introduced = new Map<string, StudyPlacementAmbiguity>();

  for (const language of languages) {
    for (const { pathname, synthetic, syntheticRoot } of pathnames) {
      const before = resolveBefore({ pathname, language }).resolution;
      const afterAnalysis = resolveAfter({ pathname, language });
      const after = afterAnalysis.resolution;
      if (after.outcome !== 'ambiguous') continue;
      if (before.outcome === 'ambiguous') {
        const beforeRefs = new Set(before.study_refs);
        if (after.study_refs.every((studyRef) => beforeRefs.has(studyRef))) continue;
      }

      const contextKey = afterAnalysis.ambiguity_context_key
        ?? `${after.study_refs.join('\u0000')}\u0001${pathname}\u0001${language}`;
      if (!introduced.has(contextKey)) {
        introduced.set(contextKey, {
          context_key: contextKey,
          study_refs: after.study_refs,
          pathname,
          synthetic_pathname: synthetic,
          ...(syntheticRoot !== undefined ? { synthetic_root: syntheticRoot } : {}),
          language,
        });
      }
    }
  }

  return [...introduced.values()];
}

/**
 * Find page/language contexts where a flagged Study becomes the winner after
 * a mutation but was not the same flagged winner before it. Comparing the
 * combined probe universe catches scope expansion by an already-flagged Study,
 * not just a newly flagged Study ID.
 */
export function findIntroducedStudyPlacementWinnerContexts(
  beforeCandidates: readonly StudyPlacementCandidate[],
  afterCandidates: readonly StudyPlacementCandidate[],
  beforeFlaggedStudyRefs: ReadonlySet<string>,
  afterFlaggedStudyRefs: ReadonlySet<string>,
): StudyPlacementWinnerContext[] {
  const combined = [...beforeCandidates, ...afterCandidates];
  const pathnames = buildPlacementProbePathnames(combined);
  const languages = buildPlacementProbeLanguages(combined);
  const resolveBefore = compileStudyPlacementCandidates(beforeCandidates);
  const resolveAfter = compileStudyPlacementCandidates(afterCandidates);
  const introduced = new Map<string, StudyPlacementWinnerContext>();

  for (const language of languages) {
    for (const { pathname, synthetic, syntheticRoot } of pathnames) {
      const after = resolveAfter({ pathname, language });
      if (after.resolution.outcome !== 'match'
        || !afterFlaggedStudyRefs.has(after.resolution.study_ref)) continue;

      const before = resolveBefore({ pathname, language }).resolution;
      if (before.outcome === 'match'
        && before.study_ref === after.resolution.study_ref
        && beforeFlaggedStudyRefs.has(before.study_ref)) continue;

      const key = `${after.resolution.study_ref}\u0000${pathname}\u0000${language}`;
      if (!introduced.has(key)) {
        introduced.set(key, {
          study_ref: after.resolution.study_ref,
          pathname,
          synthetic_pathname: synthetic,
          ...(syntheticRoot !== undefined ? { synthetic_root: syntheticRoot } : {}),
          language,
        });
      }
    }
  }

  return [...introduced.values()];
}

function canonicalPathPrefixes(pathname: string): string[] {
  if (pathname === '/') return ['/'];
  const prefixes = ['/'];
  let offset = 1;
  while (offset < pathname.length) {
    const slash = pathname.indexOf('/', offset);
    if (slash === -1) {
      prefixes.push(pathname);
      break;
    }
    prefixes.push(pathname.slice(0, slash));
    offset = slash + 1;
  }
  return prefixes;
}

function buildPlacementProbeLanguages(candidates: readonly StudyPlacementCandidate[]): WidgetLocale[] {
  const visibilities = validEnabledPlacementVisibilities(candidates);
  const seenEligibility = new Set<string>();
  return SUPPORTED_WIDGET_LOCALES.filter((language) => {
    const signature = visibilities.map((visibility) => (
      visibility.languages?.length
        ? Number(visibility.languages.includes(language))
        : 1
    )).join('');
    if (seenEligibility.has(signature)) return false;
    seenEligibility.add(signature);
    return true;
  });
}

function buildPlacementProbePathnames(
  candidates: readonly StudyPlacementCandidate[],
): Array<{ pathname: string; synthetic: boolean; syntheticRoot?: string }> {
  const visibilities = validEnabledPlacementVisibilities(candidates);
  const configuredPathnames = new Set(visibilities.flatMap((visibility) => (
    visibility.rules.map((rule) => rule.pathname)
  )));
  const pathnames = new Map<string, { synthetic: boolean; syntheticRoot?: string }>([
    ['/', { synthetic: false }],
  ]);
  for (const pathname of configuredPathnames) pathnames.set(pathname, { synthetic: false });

  const subtreeRoots = new Set<string>(['/']);
  for (const visibility of visibilities) {
    for (const rule of visibility.rules) {
      if (rule.match === 'subtree') subtreeRoots.add(rule.pathname);
    }
  }
  for (const root of subtreeRoots) {
    const probe = buildUnusedChildPathname(root, configuredPathnames);
    if (probe) pathnames.set(probe, { synthetic: true, syntheticRoot: root });
  }
  return [...pathnames.entries()]
    .map(([pathname, metadata]) => ({ pathname, ...metadata }))
    .sort((a, b) => a.pathname.localeCompare(b.pathname));
}

function validEnabledPlacementVisibilities(
  candidates: readonly StudyPlacementCandidate[],
): StudyVisibility[] {
  return candidates.flatMap((candidate) => {
    const parsed = StudyVisibilitySchema.safeParse(candidate.visibility);
    return parsed.success && parsed.data.enabled ? [parsed.data] : [];
  });
}

function buildUnusedChildPathname(root: string, configuredPathnames: ReadonlySet<string>): string | null {
  const prefix = root === '/' ? '/' : `${root}/`;
  const maxSegmentLength = MAX_PLACEMENT_PATHNAME_LENGTH - prefix.length;
  if (maxSegmentLength < 1) return null;

  const attemptLimit = configuredPathnames.size + 1;
  for (let length = 1; length <= maxSegmentLength; length += 1) {
    const capacity = BigInt(PLACEMENT_PROBE_SEGMENT_ALPHABET.length) ** BigInt(length);
    let validAttempts = 0;
    for (let ordinal = 0n; ordinal < capacity && validAttempts < attemptLimit; ordinal += 1n) {
      let value = ordinal;
      const characters = Array<string>(length).fill(PLACEMENT_PROBE_SEGMENT_ALPHABET[0]);
      for (let position = length - 1; position >= 0; position -= 1) {
        const alphabetIndex = Number(value % BigInt(PLACEMENT_PROBE_SEGMENT_ALPHABET.length));
        characters[position] = PLACEMENT_PROBE_SEGMENT_ALPHABET[alphabetIndex];
        value /= BigInt(PLACEMENT_PROBE_SEGMENT_ALPHABET.length);
      }
      const pathname = `${prefix}${characters.join('')}`;
      if (!CanonicalPlacementPathnameSchema.safeParse(pathname).success) continue;
      validAttempts += 1;
      if (!configuredPathnames.has(pathname)) return pathname;
    }
  }
  return null;
}

export function readStudyInvitation(settingsJson: string | null | undefined): StudyInvitation | null {
  const settings = parseStudySettings(settingsJson);
  if (Object.prototype.hasOwnProperty.call(settings, 'invitation')) {
    const parsed = StudyInvitationSchema.safeParse(settings.invitation);
    return parsed.success ? parsed.data : null;
  }

  return null;
}

export type StoredStudyInvitation =
  | { state: 'absent' }
  | { state: 'invalid' }
  | { state: 'valid'; invitation: StudyInvitation };

export function parseStoredStudyInvitation(settingsJson: string | null | undefined): StoredStudyInvitation {
  const storedSettings = parseStoredStudySettings(settingsJson);
  if (storedSettings.state === 'invalid') return { state: 'invalid' };
  const settings = storedSettings.settings;
  if (Object.prototype.hasOwnProperty.call(settings, 'invitation')) {
    const parsed = StudyInvitationSchema.safeParse(settings.invitation);
    return parsed.success ? { state: 'valid', invitation: parsed.data } : { state: 'invalid' };
  }
  return { state: 'absent' };
}

export function readStudyVisibility(settingsJson: string | null | undefined): StudyVisibility | null {
  const parsed = StudyVisibilitySchema.safeParse(parseStudySettings(settingsJson).visibility);
  return parsed.success ? parsed.data : null;
}

export type StoredStudyVisibility =
  | { state: 'absent' }
  | { state: 'invalid' }
  | { state: 'valid'; visibility: StudyVisibility };

export function parseStoredStudyVisibility(settingsJson: string | null | undefined): StoredStudyVisibility {
  const storedSettings = parseStoredStudySettings(settingsJson);
  if (storedSettings.state === 'invalid') return { state: 'invalid' };
  const settings = storedSettings.settings;
  if (!Object.prototype.hasOwnProperty.call(settings, 'visibility')) return { state: 'absent' };
  const parsed = StudyVisibilitySchema.safeParse(settings.visibility);
  return parsed.success ? { state: 'valid', visibility: parsed.data } : { state: 'invalid' };
}

export type StoredStudySettings =
  | { state: 'valid'; settings: Record<string, unknown> }
  | { state: 'invalid' };

export function parseStoredStudySettings(settingsJson: string | null | undefined): StoredStudySettings {
  if (settingsJson == null || settingsJson.trim() === '') return { state: 'valid', settings: {} };
  try {
    const parsed = JSON.parse(settingsJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { state: 'valid', settings: parsed as Record<string, unknown> }
      : { state: 'invalid' };
  } catch {
    return { state: 'invalid' };
  }
}

/** Resolve inherited storage semantics without weakening invalid-data handling. */
export function effectiveStoredStudyVisibility(stored: StoredStudyVisibility): StudyVisibility | null {
  if (stored.state === 'invalid') return null;
  return stored.state === 'valid' ? stored.visibility : { ...DEFAULT_STUDY_VISIBILITY, rules: [] };
}

export function mergeStudyPlacementIntoSettings(
  settingsJson: string | null | undefined,
  patch: {
    invitation?: StudyInvitation | null;
    visibility?: StudyVisibility | null;
    recruitment_campaign?: StudyRecruitmentCampaign | null;
  },
): string {
  const settings = parseStudySettings(settingsJson);
  if (patch.invitation !== undefined || patch.visibility !== undefined) delete settings.widget_appearance;
  if (patch.invitation !== undefined) {
    if (patch.invitation === null) delete settings.invitation;
    else settings.invitation = patch.invitation;
  }
  if (patch.visibility !== undefined) {
    if (patch.visibility === null) delete settings.visibility;
    else settings.visibility = patch.visibility;
  }
  if (patch.recruitment_campaign !== undefined) {
    if (patch.recruitment_campaign === null) delete settings.recruitment_campaign;
    else settings.recruitment_campaign = patch.recruitment_campaign;
  }
  return JSON.stringify(settings);
}

export function readStudyRecruitmentCampaign(
  settingsJson: string | null | undefined,
): StudyRecruitmentCampaign | null {
  const parsed = StudyRecruitmentCampaignSchema.safeParse(
    parseStudySettings(settingsJson).recruitment_campaign,
  );
  return parsed.success ? parsed.data : null;
}

/** Serialize the public recruitment artifact from stored Study configuration.
 * The opaque campaign reference is the only query value exposed; private
 * signing or participant claims are never part of this URL. */
export function buildStudyRecruitmentUrl(
  settingsJson: string | null | undefined,
  allowedOriginsJson: string | null | undefined,
): string | null {
  const invitation = parseStoredStudyInvitation(settingsJson);
  if (invitation.state !== 'valid' || invitation.invitation.presentation_mode !== 'direct_link') return null;
  const campaign = readStudyRecruitmentCampaign(settingsJson);
  if (!campaign || !allowedOriginsJson) return null;
  try {
    const origins = JSON.parse(allowedOriginsJson) as unknown;
    if (!Array.isArray(origins) || typeof origins[0] !== 'string') return null;
    const allowedOrigin = validateAllowedOrigins([origins[0]]);
    if (allowedOrigin.issues.length > 0 || allowedOrigin.origins[0] !== origins[0]) return null;
    const visibility = parseStoredStudyVisibility(settingsJson);
    const pathname = visibility.state === 'valid'
      ? visibility.visibility.rules.find((rule) => rule.effect === 'include')?.pathname ?? '/'
      : '/';
    const url = new URL(pathname, allowedOrigin.origins[0]);
    url.searchParams.set('ut_research', campaign.reference);
    return url.toString();
  } catch {
    return null;
  }
}

/** Keep one opaque reference while direct-link presentation stays enabled.
 * Leaving direct-link mode deletes it, so enabling it again creates a new,
 * previously unshared reference instead of reviving a revoked link. */
export function reconcileStudyRecruitmentCampaign(
  settingsJson: string | null | undefined,
  invitation: StudyInvitation | null,
): StudyRecruitmentCampaign | null {
  if (invitation?.presentation_mode !== 'direct_link') return null;
  return readStudyRecruitmentCampaign(settingsJson) ?? {
    reference: generateEntityId('rct', 24),
  };
}

export function stripStudyPlacementSettings(settingsJson: string | null | undefined): Record<string, unknown> {
  const settings = parseStudySettings(settingsJson);
  delete settings.invitation;
  delete settings.visibility;
  delete settings.recruitment_campaign;
  delete settings.widget_appearance;
  return settings;
}
