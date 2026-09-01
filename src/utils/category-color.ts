import { MAJOR_CATEGORIES } from "../constants/categories";

const FALLBACK_COLOR = "#111111"; // Other's color, used as a last-resort fallback.

/** Converts a hex color (#RRGGBB) to { h, s, l } with h in [0,360), s/l in [0,100]. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

/** Converts { h, s, l } (h in [0,360), s/l in [0,100]) to a hex color (#RRGGBB). */
export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hPrime = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hPrime >= 0 && hPrime < 1) [r1, g1, b1] = [c, x, 0];
  else if (hPrime < 2) [r1, g1, b1] = [x, c, 0];
  else if (hPrime < 3) [r1, g1, b1] = [0, c, x];
  else if (hPrime < 4) [r1, g1, b1] = [0, x, c];
  else if (hPrime < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = lNorm - c / 2;

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`.toUpperCase();
}

/** Looks up a major category's fixed color by exact name match. */
export function colorForCategory(name: string): string {
  return MAJOR_CATEGORIES.find((c) => c.name === name)?.color ?? FALLBACK_COLOR;
}

/**
 * Derives a lightness-varied version of a major's color for one of its
 * subcategories, so siblings are visually distinct while staying on-hue with
 * their parent. Deterministic: same parent + same siblingIndex always gives
 * the same color.
 */
export function colorForSubcategory(parentName: string, siblingIndex: number): string {
  const base = colorForCategory(parentName);
  const { h, s, l } = hexToHsl(base);

  const delta = (Math.floor(siblingIndex / 2) + 1) * 9;
  const sign = siblingIndex % 2 === 0 ? 1 : -1;
  const newL = Math.min(85, Math.max(15, l + sign * delta));

  return hslToHex(h, s, newL);
}

/**
 * Golden-angle HSL generator for the color a NEW major category (beyond the
 * fixed 10) would get, if a user ever creates one via the "Other → define a
 * new major category" flow. Forward-looking infrastructure only — that flow
 * is still intentionally inert; nothing calls this yet.
 */
export function nextMajorColor(existingCustomMajorCount: number): string {
  const hue = (137.508 * (existingCustomMajorCount + 1)) % 360;
  return hslToHex(hue, 65, 52);
}
