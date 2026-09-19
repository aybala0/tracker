import { useEffect, useState } from "react";
import type { DrillItem } from "../types";
import { CATS } from "../constants/categories";
import { colorForSubcategory } from "../utils/category-color";
import { fg } from "../utils/color";
import { money } from "../utils/format";
import { CategoryChip } from "./CategoryChip";

type Props = {
  item: DrillItem;
  tagBg: string;
  tagFg: string;
  /** The category this drill-down list is currently showing — the starting point for the editor's category selection. */
  currentCategory: string;
  onSave: (opts: {
    cat: string;
    sub: string | null;
    description?: string;
    ruleContains?: string;
    shared: boolean;
    hayatDescription?: string;
  }) => void;
};

export function DrillRow({ item, tagBg, tagFg, currentCategory, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [cat, setCat] = useState(currentCategory);
  const [sub, setSub] = useState<string | null>(item.sub ?? null);
  const [subOptions, setSubOptions] = useState<string[]>([]);
  const [desc, setDesc] = useState(item.desc);
  const [shared, setShared] = useState(item.shared);
  const [hayatDesc, setHayatDesc] = useState("");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleContains, setRuleContains] = useState("");

  // Reset the editor to the row's current real values whenever it opens or
  // closes, so a cancelled edit never leaks into the next time it's opened.
  useEffect(() => {
    if (editing) {
      setCat(currentCategory);
      setSub(item.sub ?? null);
      setDesc(item.desc);
      setShared(item.shared);
      setHayatDesc("");
      setRuleOpen(false);
      setRuleContains("");
    }
  }, [editing, currentCategory, item.sub, item.desc, item.shared]);

  // Real subcategory suggestions for the selected major, same source as the
  // inbox editor's.
  useEffect(() => {
    if (!editing || !cat || cat === "Other") {
      setSubOptions([]);
      return;
    }
    let cancelled = false;
    fetch("/api/categories")
      .then((res) => res.json())
      .then((majors: { name: string; subcategories: { id: string; name: string }[] }[]) => {
        if (cancelled) return;
        const match = majors.find((m) => m.name === cat);
        setSubOptions(match ? match.subcategories.map((s) => s.name) : []);
      })
      .catch(() => {
        if (!cancelled) setSubOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, cat]);

  const goingSharedOn = shared && !item.shared;
  const canSave = !goingSharedOn || hayatDesc.trim().length > 0;

  const handleSave = () => {
    if (item.shared && !shared) {
      const ok = window.confirm(`Unmark "${item.desc}" as shared and remove it from the Hayat sheet?`);
      if (!ok) return;
    }
    onSave({
      cat,
      sub,
      description: desc.trim() && desc.trim() !== item.desc ? desc.trim() : undefined,
      ruleContains: ruleOpen ? ruleContains.trim() || undefined : undefined,
      shared,
      hayatDescription: goingSharedOn ? hayatDesc.trim() : undefined,
    });
    setEditing(false);
  };

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
              <span style={{ background: "#fcba03", border: "1.5px solid #000", padding: "2px 7px", font: "700 11px Archivo" }}>
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
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3.5" style={{ background: "#f5f4f1", padding: 16 }}>
          <div
            className="mb-1 uppercase"
            style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".14em", color: "rgba(0,0,0,.62)" }}
          >
            Name
          </div>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mb-[18px] w-full"
            style={{ height: 40, border: "1.5px solid rgba(0,0,0,.3)", background: "#fff", padding: "0 10px", font: "500 14px Archivo" }}
          />

          <div
            className="mb-2 uppercase"
            style={{ font: "700 9.5px 'Space Mono', monospace", letterSpacing: ".18em", color: "rgba(0,0,0,.62)" }}
          >
            Category
          </div>
          <div className="mb-[18px] flex flex-wrap gap-1.5">
            {CATS.map((n) => (
              <CategoryChip
                key={n}
                name={n}
                active={cat === n}
                onClick={() => {
                  setCat(n);
                  setSub(null);
                }}
              />
            ))}
          </div>

          {cat !== "Other" && (
            <div className="mb-[18px]">
              <div
                className="mb-2"
                style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(0,0,0,.62)" }}
              >
                Subcategory
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subOptions.map((n, i) => {
                  const active = sub === n;
                  const subColor = colorForSubcategory(cat, i);
                  return (
                    <div
                      key={n}
                      onClick={() => setSub(active ? null : n)}
                      className="grid cursor-pointer place-items-center"
                      style={{
                        minHeight: 34,
                        padding: "0 11px",
                        border: `1.5px solid ${active ? "#000" : "rgba(0,0,0,.22)"}`,
                        background: active ? subColor : "transparent",
                        color: active ? fg(subColor) : "#2d2b2b",
                        font: "500 13px Archivo",
                      }}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div
            onClick={() => setRuleOpen((o) => !o)}
            className="mb-3 inline-block cursor-pointer uppercase underline"
            style={{ font: "700 10.5px Archivo", letterSpacing: ".06em", color: "rgba(0,0,0,.6)" }}
          >
            {ruleOpen ? "Cancel rule" : "+ Repeats? Make it a rule"}
          </div>
          {ruleOpen && (
            <div className="mb-[18px]" style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,.3)", padding: 12 }}>
              <div className="mb-2" style={{ font: "500 13px Archivo", lineHeight: 1.5 }}>
                Label as <strong>{cat}{sub ? ` · ${sub}` : ""}</strong> if description contains
              </div>
              <input
                autoFocus
                value={ruleContains}
                onChange={(e) => setRuleContains(e.target.value)}
                placeholder="e.g. metra"
                className="w-full"
                style={{ height: 38, border: "1.5px solid rgba(0,0,0,.3)", padding: "0 10px", font: "500 14px Archivo" }}
              />
            </div>
          )}

          <div className="mb-[18px] pt-4" style={{ borderTop: "1.5px solid rgba(0,0,0,.2)" }}>
            <div
              onClick={() => setShared((s) => !s)}
              className="flex cursor-pointer items-center gap-2"
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  border: "2px solid #000",
                  background: shared ? "#17BEBB" : "#fff",
                  flexShrink: 0,
                }}
              />
              <span className="uppercase" style={{ font: "700 11px Archivo", letterSpacing: ".06em" }}>
                Shared 50/50 with Hayat
              </span>
            </div>
            {goingSharedOn && (
              <div className="mt-3">
                <div
                  className="mb-1 uppercase"
                  style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".14em", color: "rgba(0,0,0,.62)" }}
                >
                  Description (short) — for the Hayat sheet
                </div>
                <input
                  autoFocus
                  value={hayatDesc}
                  onChange={(e) => setHayatDesc(e.target.value)}
                  placeholder="e.g. TJ run"
                  className="w-full"
                  style={{ height: 40, border: "1.5px solid rgba(0,0,0,.3)", background: "#fff", padding: "0 10px", font: "500 14px Archivo" }}
                />
              </div>
            )}
            {item.shared && !shared && (
              <div className="mt-2" style={{ font: "500 12px Archivo", color: "rgba(0,0,0,.55)" }}>
                Removes the row this app wrote to the Hayat sheet, if any.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="grid w-full place-items-center uppercase disabled:opacity-40"
            style={{ height: 48, background: "#000", color: "#fff", font: "800 13px Archivo", letterSpacing: ".1em" }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
