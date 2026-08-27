import { slices } from "../utils/pie";

type Props = {
  data: Record<string, number>;
  r: number;
  cx: number;
  cy: number;
  viewBoxSize: number;
  size: number;
  selected?: string | null;
  interactive?: boolean;
  onSelect?: (name: string) => void;
};

/** Renders a pie chart from a category->amount map using the design's exact wedge geometry. */
export function PieChart({ data, r, cx, cy, viewBoxSize, size, selected = null, interactive = false, onSelect }: Props) {
  const { out } = slices(data, r, cx, cy, selected, interactive);

  return (
    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{ width: size, height: size, flexShrink: 0, cursor: interactive ? "pointer" : "default" }}>
      {out.map((s) => (
        <path
          key={s.name}
          d={s.d}
          fill={s.color}
          stroke="#000"
          strokeWidth={interactive ? 1 : 2}
          transform={interactive ? s.tf : undefined}
          onClick={interactive && onSelect ? () => onSelect(s.name) : undefined}
          style={{ transition: "transform .18s ease" }}
        />
      ))}
    </svg>
  );
}
