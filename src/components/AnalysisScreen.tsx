import { useEffect, useState } from "react";
import { useSpendTrends, type Granularity, type TrendSeries } from "../hooks/useSpendTrend";
import { MAJOR_CATEGORIES } from "../constants/categories";
import { short, bucketLabel } from "../utils/format";
import { LineChart, type ChartSeries } from "./LineChart";
import { CategoryChip } from "./CategoryChip";
import { colorForCategory, colorForSubcategory } from "../utils/category-color";

const MONTH_RANGES = [3, 6, 12] as const;
const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "month", label: "M" },
  { key: "week", label: "W" },
  { key: "day", label: "D" },
];
const ALL_KEY = "All";
// Neutral gray, deliberately outside the 10 fixed category hues (src/constants/categories.ts)
// so the aggregate "All" line never reads as one more category when stacked alongside them.
const ALL_COLOR = "#5C5C5C";
// Subcategory selections are keyed by id, not name — names only have to be
// unique within their major, so two majors can both have e.g. "Other".
const subKey = (id: string) => `sub:${id}`;

type Major = { name: string; subcategories: { id: string; name: string }[] };
type SeriesDef = TrendSeries & { label: string };

function segButtonStyle(active: boolean, first: boolean) {
  return {
    height: 22,
    minWidth: 26,
    borderLeft: first ? "none" : "1.5px solid #000",
    background: active ? "#000" : "#fff",
    color: active ? "#fff" : "#000",
    font: "800 9.5px Archivo",
    letterSpacing: ".03em",
  } as const;
}

export function AnalysisScreen() {
  const [selected, setSelected] = useState<Set<string>>(new Set([ALL_KEY]));
  const [range, setRange] = useState<(typeof MONTH_RANGES)[number]>(6);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [majors, setMajors] = useState<Major[]>([]);
  // The major whose subcategory chips are showing below the category grid.
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data: Major[]) => setMajors(data))
      .catch(() => {});
  }, []);

  const subsOf = (name: string) => majors.find((m) => m.name === name)?.subcategories ?? [];

  const toggle = (name: string) => {
    setHoverIdx(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // A major with subcategories opens its subcategory row instead of toggling,
  // so a subcategory can be picked without also plotting its parent. The
  // parent itself is the first chip in that row. Majors without any
  // subcategories have nothing to open and just toggle.
  const onMajorClick = (name: string) => {
    if (subsOf(name).length === 0) toggle(name);
    else setExpanded((prev) => (prev === name ? null : name));
  };

  const seriesDefs: SeriesDef[] = [];
  if (selected.has(ALL_KEY)) seriesDefs.push({ key: ALL_KEY, label: "All spending", category: null, color: ALL_COLOR });
  for (const c of MAJOR_CATEGORIES) {
    if (selected.has(c.name)) seriesDefs.push({ key: c.name, label: c.name, category: c.name, color: c.color });
    subsOf(c.name).forEach((sub, i) => {
      if (!selected.has(subKey(sub.id))) return;
      seriesDefs.push({
        key: subKey(sub.id),
        label: `${c.name} › ${sub.name}`,
        category: null,
        subcategoryId: sub.id,
        color: colorForSubcategory(c.name, i),
      });
    });
  }

  const { data, loading } = useSpendTrends(seriesDefs, range, granularity);

  const chartSeries: ChartSeries[] = seriesDefs
    .filter((s) => (data[s.key]?.length ?? 0) > 0)
    .map((s) => ({ key: s.key, color: s.color, points: data[s.key] }));

  const anyPoints = chartSeries[0]?.points ?? [];
  const idx = hoverIdx ?? anyPoints.length - 1;
  const dateLabel = anyPoints[idx] ? bucketLabel(anyPoints[idx].bucket, granularity) : "";

  return (
    <div className="flex-1 overflow-y-auto px-[22px] pb-[26px] pt-[18px]">
      <div className="mb-4 flex items-start justify-between">
        <div className="uppercase" style={{ font: "900 30px/1 Archivo", letterSpacing: "-.03em" }}>
          Analysis
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex" style={{ border: "1.5px solid #000" }}>
            {GRANULARITIES.map((g, i) => (
              <button key={g.key} type="button" onClick={() => setGranularity(g.key)} className="uppercase" style={segButtonStyle(granularity === g.key, i === 0)}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex" style={{ border: "1.5px solid #000" }}>
            {MONTH_RANGES.map((m, i) => (
              <button key={m} type="button" onClick={() => setRange(m)} className="uppercase" style={segButtonStyle(range === m, i === 0)}>
                {m}M
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3.5" style={{ border: "2px solid #000", padding: "14px 16px" }}>
        <div className="mb-2 uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em", color: "rgba(0,0,0,.55)" }}>
          {dateLabel || (loading ? "Loading…" : "No categories selected")}
        </div>
        {seriesDefs.length === 0 ? (
          <div style={{ font: "600 13px Archivo", color: "rgba(0,0,0,.5)" }}>Pick a category below to plot its trend.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {seriesDefs.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span style={{ width: 11, height: 11, flexShrink: 0, background: s.color, border: "1.5px solid #000" }} />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ font: "600 13px Archivo" }}>
                  {s.label}
                </span>
                <span style={{ font: "800 15px Archivo", fontVariantNumeric: "tabular-nums" }}>
                  {short(data[s.key]?.[idx]?.total ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-[22px] pb-3.5" style={{ border: "2px solid #000", background: "#fff" }}>
        {chartSeries.length > 0 ? (
          <LineChart series={chartSeries} granularity={granularity} height={190} onHoverIndex={setHoverIdx} />
        ) : (
          <div style={{ height: 190, display: "grid", placeItems: "center", font: "600 12.5px Archivo", color: "rgba(0,0,0,.4)" }}>
            {loading ? "Loading…" : "Nothing to chart yet"}
          </div>
        )}
      </div>

      <div className="mb-2 uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em" }}>
        By category
      </div>
      <div className={`${expanded ? "mb-3" : "mb-[22px]"} flex flex-wrap gap-1.5`}>
        <CategoryChip name={ALL_KEY} color={ALL_COLOR} active={selected.has(ALL_KEY)} onClick={() => toggle(ALL_KEY)} size="sm" />
        {MAJOR_CATEGORIES.map((c) => {
          const subs = subsOf(c.name);
          const subCount = subs.filter((sub) => selected.has(subKey(sub.id))).length;
          return (
            <CategoryChip
              key={c.slug}
              name={subs.length > 0 ? `${c.name} ${expanded === c.name ? "▴" : "▾"}${subCount > 0 ? ` · ${subCount}` : ""}` : c.name}
              color={c.color}
              active={selected.has(c.name)}
              onClick={() => onMajorClick(c.name)}
              size="sm"
            />
          );
        })}
      </div>

      {expanded && (
        <div className="mb-[22px]">
          <div className="mb-2 uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em" }}>
            {expanded} · Subcategories
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CategoryChip
              name={`All ${expanded}`}
              color={colorForCategory(expanded)}
              active={selected.has(expanded)}
              onClick={() => toggle(expanded)}
              size="sm"
            />
            {subsOf(expanded).map((sub, i) => (
              <CategoryChip
                key={sub.id}
                name={sub.name}
                color={colorForSubcategory(expanded, i)}
                active={selected.has(subKey(sub.id))}
                onClick={() => toggle(subKey(sub.id))}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
