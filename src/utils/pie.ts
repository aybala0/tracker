import { colorForCategory } from "./category-color";

export type Slice = {
  name: string;
  amount: number;
  frac: number;
  color: string;
  /** stroke width — thicker when this slice is the selected one */
  sw: number;
  /** SVG path `d` for the wedge */
  d: string;
  /** SVG transform that nudges the selected wedge outward */
  tf: string;
};

/**
 * Computes pie-slice geometry for a category->amount map, matching the
 * design's `slices()` helper exactly: a clockwise pie starting at 12
 * o'clock, with the selected wedge (when `pull` is set) nudged outward.
 */
export function slices(
  data: Record<string, number>,
  r: number,
  cx: number,
  cy: number,
  sel: string | null,
  pull: boolean
): { out: Slice[]; total: number } {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  let a0 = -Math.PI / 2;
  const out: Slice[] = [];
  Object.keys(data).forEach((k) => {
    const frac = data[k] / total;
    const a1 = a0 + frac * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    // Pull distance is inversely related to the slice's own share of the
    // pie: a thin sliver needs a bigger nudge than a wide slice to read as
    // clearly "popped out," since the same absolute offset creates a much
    // smaller visual gap along a narrow arc than a wide one.
    const off = pull && sel === k ? 11 + (1 - frac) * 9 : 0;
    out.push({
      name: k,
      amount: data[k],
      frac,
      color: colorForCategory(k),
      sw: sel === k ? 4 : 2,
      d: `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      tf: `translate(${(off * Math.cos(mid)).toFixed(2)} ${(off * Math.sin(mid)).toFixed(2)})`,
    });
    a0 = a1;
  });
  return { out, total };
}
