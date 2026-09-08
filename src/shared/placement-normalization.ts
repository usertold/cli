import { pickWidgetLocale } from './widget-locales';

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
