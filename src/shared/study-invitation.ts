import {
  DEFAULT_WIDGET_BRAND_COLOR,
  DEFAULT_WIDGET_BRAND_COLOR_DARK,
} from './widget-appearance-colors';

export const INVITATION_ICONS = ['feedback', 'bug', 'research'] as const;
export const INVITATION_PRESENTATION_MODES = ['passive', 'contextual', 'direct_link'] as const;
export const INVITATION_REWARD_KINDS = ['gift', 'product', 'community', 'access'] as const;
export const INVITATION_CORNERS = ['bottom-left', 'bottom-right'] as const;

export interface StudyInvitation {
  launcher: {
    label: string;
    icon: typeof INVITATION_ICONS[number];
  };
  panel?: {
    eyebrow?: string;
    headline: string;
    body?: string;
    duration_minutes?: number;
    reward?: {
      kind: typeof INVITATION_REWARD_KINDS[number];
      label: string;
      eligibility?: string;
      delivery?: string;
    };
    cta: string;
    image?: {
      asset_id: string;
      url: string;
      alt: string;
    };
  };
  presentation_mode: typeof INVITATION_PRESENTATION_MODES[number];
  brand_color: {
    light: string;
    dark?: string;
  };
  placement: {
    desktop: typeof INVITATION_CORNERS[number];
    mobile: typeof INVITATION_CORNERS[number];
  };
}

export const DEFAULT_STUDY_INVITATION = {
  launcher: { label: 'Share feedback', icon: 'feedback' },
  presentation_mode: 'passive',
  brand_color: { light: DEFAULT_WIDGET_BRAND_COLOR, dark: DEFAULT_WIDGET_BRAND_COLOR_DARK },
  placement: { desktop: 'bottom-right', mobile: 'bottom-right' },
} as const satisfies StudyInvitation;

const isObject = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]) => (
  Object.keys(value).every((key) => keys.includes(key))
);
const isText = (value: unknown, max: number) => (
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
);
const isOptionalText = (value: unknown, max: number) => value === undefined || isText(value, max);

/** Lightweight runtime guard for cached widget data; the authoritative write
 * contract remains StudyInvitationSchema. Keeping this guard dependency-free
 * avoids shipping the schema library in the embed bundle. */
export function isStudyInvitation(value: unknown): value is StudyInvitation {
  if (!isObject(value) || !hasOnly(value, ['launcher', 'panel', 'presentation_mode', 'brand_color', 'placement'])) return false;
  const launcher = value.launcher;
  const brand = value.brand_color;
  const placement = value.placement;
  if (!isObject(launcher) || !hasOnly(launcher, ['label', 'icon'])
    || !isText(launcher.label, 80) || !INVITATION_ICONS.includes(launcher.icon as typeof INVITATION_ICONS[number])
    || !INVITATION_PRESENTATION_MODES.includes(value.presentation_mode as typeof INVITATION_PRESENTATION_MODES[number])
    || !isObject(brand) || !hasOnly(brand, ['light', 'dark'])
    || typeof brand.light !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(brand.light)
    || (brand.dark !== undefined && (typeof brand.dark !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(brand.dark)))
    || !isObject(placement) || !hasOnly(placement, ['desktop', 'mobile'])
    || !INVITATION_CORNERS.includes(placement.desktop as typeof INVITATION_CORNERS[number])
    || !INVITATION_CORNERS.includes(placement.mobile as typeof INVITATION_CORNERS[number])) return false;

  const panel = value.panel;
  if (value.presentation_mode !== 'passive' && panel === undefined) return false;
  if (panel === undefined) return true;
  if (!isObject(panel) || !hasOnly(panel, ['eyebrow', 'headline', 'body', 'duration_minutes', 'reward', 'cta', 'image'])
    || !isOptionalText(panel.eyebrow, 80) || !isText(panel.headline, 120)
    || !isOptionalText(panel.body, 600) || !isText(panel.cta, 80)
    || (panel.duration_minutes !== undefined
      && (!Number.isInteger(panel.duration_minutes) || (panel.duration_minutes as number) < 1 || (panel.duration_minutes as number) > 240))) return false;

  const reward = panel.reward;
  if (reward !== undefined && (!isObject(reward) || !hasOnly(reward, ['kind', 'label', 'eligibility', 'delivery'])
    || !INVITATION_REWARD_KINDS.includes(reward.kind as typeof INVITATION_REWARD_KINDS[number])
    || !isText(reward.label, 160) || !isOptionalText(reward.eligibility, 240) || !isOptionalText(reward.delivery, 240))) return false;
  const image = panel.image;
  if (image !== undefined) {
    if (!isObject(image) || !hasOnly(image, ['asset_id', 'url', 'alt']) || !isText(image.asset_id, 160)
      || typeof image.alt !== 'string' || image.alt.trim().length > 160 || typeof image.url !== 'string' || image.url.length > 2_000) return false;
    try { if (new URL(image.url).protocol !== 'https:') return false; } catch { return false; }
  }
  return true;
}
