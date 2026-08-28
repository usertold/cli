/**
 * The built-in brand is neutral ink, as a light/dark pair: near-black on
 * light surfaces, near-white on dark. The widget ships onto customers'
 * pages, so its default must recede into any host design; color is a
 * customer decision made via `brand_color` / `brandColor`, never a
 * UserTold identity export.
 */
export const DEFAULT_WIDGET_BRAND_COLOR = '#1f2226';
export const DEFAULT_WIDGET_BRAND_COLOR_DARK = '#edeff1';

export function widgetAppearanceForegroundColor(hex: string): '#000' | '#fff' {
  const rgb = Number.parseInt(hex.slice(1), 16);
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(rgb >> 16)
    + 0.7152 * channel((rgb >> 8) & 255)
    + 0.0722 * channel(rgb & 255);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? '#000' : '#fff';
}
