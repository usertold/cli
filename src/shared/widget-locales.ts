import { normalizeLocaleTag, pickSupportedLocale } from './locale';

export const WIDGET_SOURCE_LOCALE = 'en';
export const SUPPORTED_WIDGET_LOCALES = ['en', 'es', 'ru', 'fr', 'de', 'zh-Hans', 'ja'] as const;
export type WidgetLocale = typeof SUPPORTED_WIDGET_LOCALES[number];

export function isSupportedWidgetLocale(locale: string): locale is WidgetLocale {
  return (SUPPORTED_WIDGET_LOCALES as readonly string[]).includes(locale);
}

export function pickWidgetLocale(value: string | null | undefined): WidgetLocale | null {
  if (!value?.trim()) return null;
  const selected = pickSupportedLocale(expandWidgetLocaleCandidates([value]), SUPPORTED_WIDGET_LOCALES, WIDGET_SOURCE_LOCALE);
  const primary = value.trim().replace(/_/g, '-').split('-')[0]?.toLowerCase();
  if (selected === WIDGET_SOURCE_LOCALE && primary !== 'en') return null;
  return selected;
}

const SIMPLIFIED_CHINESE_REGIONS = new Set(['CN', 'SG', 'MY']);

export function expandWidgetLocaleCandidates(
  candidates: readonly (string | null | undefined)[],
): Array<string | null | undefined> {
  const expanded: Array<string | null | undefined> = [];
  for (const candidate of candidates) {
    expanded.push(candidate);
    const normalized = normalizeLocaleTag(candidate);
    if (!normalized) continue;
    const parts = normalized.split('-');
    if (parts[0]?.toLowerCase() !== 'zh') continue;
    const script = parts.find((part) => /^[A-Z][a-z]{3}$/.test(part));
    const region = parts.find((part) => /^[A-Z]{2}$/.test(part) || /^\d{3}$/.test(part));
    if (script?.toLowerCase() === 'hans' || (!script && (!region || SIMPLIFIED_CHINESE_REGIONS.has(region)))) {
      expanded.push('zh-Hans');
    }
  }
  return expanded;
}
