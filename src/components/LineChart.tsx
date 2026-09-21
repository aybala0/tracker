import { useState } from "react";
import type { Granularity, TrendPoint } from "../hooks/useSpendTrend";
import { bucketLabel } from "../utils/format";

export type ChartSeries = { key: string; color: string; points: TrendPoint[] };

type Props = {
  series: ChartSeries[];
  granularity: Granularity;
  width?: number;
  height?: number;
  onHoverIndex?: (index: number | null) => void;
};

const PAD_TOP = 14;
const PAD_BOTTOM = 24;
const PAD_X = 14;
const MAX_LABELS = 7;
// Above this many points (daily ranges, or weekly over a year), per-point circle borders sit close
// enough together that they read as one solid black smear rather than individual markers — so past
// this density the line alone carries the series, and only the hovered point still gets a dot.
const DENSE_THRESHOLD = 30;

/** Hand-rolled SVG multi-line chart for overlaying several month/week/day spend series, matching the app's flat brutalist chart style (straight segments, bordered markers, no curve smoothing). */
export function LineChart({ series, granularity, width = 320, height = 180, onHoverIndex }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const points = series[0]?.points ?? [];
  if (points.length === 0) {
    return <div style={{ height, display: "grid", placeItems: "center" }} />;
  }

  const max = Math.max(...series.flatMap((s) => s.points.map((p) => p.total)), 1);
  const plotW = width - PAD_X * 2;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;

  const xAt = (i: number) => PAD_X + step * i;
  const yAt = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const labelEvery = Math.max(1, Math.ceil(points.length / MAX_LABELS));
  const dense = points.length > DENSE_THRESHOLD;

  const select = (i: number | null) => {
    setHover(i);
    onHoverIndex?.(i);
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      onMouseLeave={() => select(null)}
    >
      <line x1={PAD_X} y1={PAD_TOP + plotH} x2={width - PAD_X} y2={PAD_TOP + plotH} stroke="rgba(0,0,0,.18)" strokeWidth={1.5} />

      {hover !== null && (
        <line x1={xAt(hover)} y1={PAD_TOP} x2={xAt(hover)} y2={PAD_TOP + plotH} stroke="rgba(0,0,0,.28)" strokeWidth={1.5} strokeDasharray="3 3" />
      )}

      {series.map((s) => {
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.total).toFixed(2)}`).join(" ");
        return <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
      })}

      {points.map((p, i) => (
        <rect
          key={p.bucket}
          x={xAt(i) - step / 2}
          y={0}
          width={step || plotW}
          height={height}
          fill="transparent"
          onMouseEnter={() => select(i)}
          onClick={() => select(hover === i ? null : i)}
          style={{ cursor: "pointer" }}
        />
      ))}

      {series.map((s) =>
        s.points.map((p, i) => {
          const isActive = hover === i;
          if (dense && !isActive) return null;
          return (
            <circle
              key={`${s.key}-${p.bucket}`}
              cx={xAt(i)}
              cy={yAt(p.total)}
              r={isActive ? 5.5 : 3}
              fill={s.color}
              stroke="#000"
              strokeWidth={isActive ? 2.5 : 1.5}
              style={{ pointerEvents: "none" }}
            />
          );
        })
      )}

      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text
            key={p.bucket}
            x={xAt(i)}
            y={height - 6}
            textAnchor="middle"
            style={{
              font: `700 9px 'Space Mono', monospace`,
              letterSpacing: ".06em",
              fill: hover === i ? "#000" : "rgba(0,0,0,.45)",
            }}
          >
            {bucketLabel(p.bucket, granularity).toUpperCase()}
          </text>
        ) : null
      )}
    </svg>
  );
}
