import { useState } from "react";
import type { DrillItem } from "../types";
import { CATS } from "../constants/categories";
import { money } from "../utils/format";
import { CategoryChip } from "./CategoryChip";

type Props = {
  item: DrillItem;
  tagBg: string;
  tagFg: string;
  /** The category this drill-down list is currently showing, highlighted in the relabel picker. */
  currentCategory: string;
  onRelabel: (toCategory: string) => void;
};

export function DrillRow({ item, tagBg, tagFg, currentCategory, onRelabel }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div className="flex items-start gap-3" style={{ padding: "13px 0", borderBottom: "1px solid rgba(0,0,0,.15)" }}>
        <div className="min-w-0 flex-1">
          <div style={{ font: "600 14px/1.3 Archivo" }}>{item.desc}</div>
          <div className="mt-[7px] flex flex-wrap items-center gap-1.5">
            <span style={{ background: tagBg, color: tagFg, border: "1.5px solid #000", padding: "2px 7px", font: "700 11px Archivo" }}>
              {item.tag}
            </span>
            {item.shared && (
              <span style={{ background: "#17BEBB", border: "1.5px solid #000", padding: "2px 7px", font: "700 11px Archivo" }}>
                Hayat 50/50
              </span>
            )}
            <span
              className="uppercase"
              style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".12em", color: "rgba(0,0,0,.62)" }}
            >
              {item.date}
            </span>
          </div>
        </div>
        <div className="flex-none text-right">
          <div style={{ font: "800 15.5px Archivo", fontVariantNumeric: "tabular-nums" }}>{money(item.amt)}</div>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="mt-1.5 uppercase underline"
            style={{ font: "700 11px Archivo", letterSpacing: ".08em" }}
          >
            Relabel
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3.5" style={{ background: "#f5f4f1", padding: 16 }}>
          <div
            className="mb-2.5"
            style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(0,0,0,.62)" }}
          >
            Move &ldquo;{item.desc.length > 22 ? item.desc.slice(0, 22) + "…" : item.desc}&rdquo; to
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((n) => (
              <CategoryChip
                key={n}
                name={n}
                active={n === currentCategory}
                onClick={() => {
                  onRelabel(n);
                  setEditing(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
