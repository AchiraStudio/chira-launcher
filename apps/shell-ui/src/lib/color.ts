const HEX = /^#[0-9a-fA-F]{6}$/;

/** Mirrors the engine's validation: exactly `#RRGGBB`. The engine remains the authority. */
export function isValidHex(value: string): boolean {
  return HEX.test(value.trim());
}

export function normalizeHex(value: string): string {
  return value.trim().toUpperCase();
}

function channel(hex: string, start: number): number {
  return parseInt(hex.slice(start, start + 2), 16) / 255;
}

function linear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of `#RRGGBB`. */
export function luminance(hex: string): number {
  return (
    0.2126 * linear(channel(hex, 1)) +
    0.7152 * linear(channel(hex, 3)) +
    0.0722 * linear(channel(hex, 5))
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT_FG = '#FFFFFF';
const DARK_FG = '#0B0D10';

/** Picks the text colour with the better contrast on an accent background. */
export function readableForeground(background: string): string {
  return contrastRatio(background, LIGHT_FG) >= contrastRatio(background, DARK_FG)
    ? LIGHT_FG
    : DARK_FG;
}
