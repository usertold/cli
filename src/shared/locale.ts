export function normalizeLocaleTag(input: string | null | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/_/g, '-');
  try {
    return Intl.getCanonicalLocales(normalized)[0] ?? null;
  } catch {
    const parts = normalized.split('-').filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    return [
      parts[0].toLowerCase(),
      ...parts.slice(1).map((part) => {
        if (/^[a-z]{2}$/i.test(part) || /^\d{3}$/.test(part)) {
          return part.toUpperCase();
        }
        if (/^[a-z]{4}$/i.test(part)) {
          return part[0].toUpperCase() + part.slice(1).toLowerCase();
        }
        return part;
      }),
    ].join('-');
  }
}

export function pickSupportedLocale<const TLocale extends string>(
  candidates: readonly (string | null | undefined)[],
  supportedLocales: readonly TLocale[],
  fallbackLocale: TLocale,
): TLocale {
  const supportedByLower = new Map(supportedLocales.map((locale) => [locale.toLowerCase(), locale] as const));

  for (const candidate of candidates) {
    const normalized = normalizeLocaleTag(candidate);
    if (!normalized) {
      continue;
    }

    const parts = normalized.split('-');
    for (let length = parts.length; length >= 1; length -= 1) {
      const lookup = parts.slice(0, length).join('-').toLowerCase();
      const supported = supportedByLower.get(lookup);
      if (supported) {
        return supported;
      }
    }
  }

  return fallbackLocale;
}
