import { useState } from "react";
import { useCategoryTotals } from "../hooks/useCategoryTotals";
import { useDrillTransactions } from "../hooks/useDrillTransactions";
import { MONTH_OPTIONS } from "../constants/categories";
import { slices } from "../utils/pie";
import { fg } from "../utils/color";
import { short } from "../utils/format";
import { PieChart } from "./PieChart";
import { CategoryChip } from "./CategoryChip";
import { DrillRow } from "./DrillRow";

export function CategoriesScreen() {
  const [month, setMonth] = useState(MONTH_OPTIONS[0]);
  const [sel, setSel] = useState<string | null>(null);
  const totals = useCategoryTotals(month);
  const { items, relabel, unshare } = useDrillTransactions(sel, month);

  const toggleSel = (name: string) => setSel((prev) => (prev === name ? null : name));

  const { out, total } = slices(totals, 96, 110, 110, sel, true);
  const selSlice = sel ? out.find((x) => x.name === sel) : undefined;
  const headColor = selSlice ? selSlice.color : "#000";

  return (
    <div className="flex-1 overflow-y-auto px-[22px] pb-[26px] pt-[18px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="uppercase" style={{ font: "900 30px/1 Archivo", letterSpacing: "-.03em" }}>
          Categories
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="cursor-pointer"
          style={{ height: 38, border: "2px solid #000", background: "#fff", font: "800 12px Archivo", letterSpacing: ".04em", padding: "0 6px 0 10px" }}
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="mb-3.5" style={{ background: sel ? headColor : "#000", color: fg(sel ? headColor : "#000"), border: "2px solid #000", padding: "14px 16px" }}>
        <div className="mb-1 uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em" }}>
          {selSlice ? selSlice.name : ""}
        </div>
        <div className="flex items-baseline gap-2.5">
          <div style={{ font: "900 34px/1 Archivo", letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums" }}>
            {selSlice ? short(selSlice.amount) : ""}
          </div>
          <div style={{ font: "600 12px Archivo" }}>
            {selSlice ? `${Math.round(selSlice.frac * 100)}% of ${short(total)}` : ""}
          </div>
        </div>
      </div>

      <div className="my-1 grid place-items-center pb-3.5">
        <PieChart data={totals} r={96} cx={110} cy={110} viewBoxSize={220} size={252} selected={sel} interactive onSelect={toggleSel} />
      </div>

      <div className="mb-[22px] flex flex-wrap gap-1.5">
        {out.map((s) => (
          <CategoryChip key={s.name} name={s.name} active={sel === s.name} onClick={() => toggleSel(s.name)} size="sm" />
        ))}
      </div>

      {sel && (
        <>
          <div className="mb-0.5 flex items-center justify-between pt-3.5" style={{ borderTop: "2px solid #000" }}>
            <div className="uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em" }}>
              {sel} · {month.split(" ")[0]}
            </div>
            <div style={{ font: "600 11.5px Archivo", color: "rgba(0,0,0,.55)" }}>
              {items.length ? `${items.length} transactions` : "nothing logged"}
            </div>
          </div>

          {items.map((d) => (
            <DrillRow
              key={d.id}
              item={d}
              tagBg={headColor}
              tagFg={fg(headColor)}
              currentCategory={sel}
              onRelabel={(toCategory) => relabel(d.id, toCategory, d.shared)}
              onUnshare={() => unshare(d.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
