import { useEffect, useState } from "react";
import type { Tier, Transaction } from "../types";
import { CATS } from "../constants/categories";
import { colorForCategory, colorForSubcategory } from "../utils/category-color";
import { fg } from "../utils/color";
import { moneySigned } from "../utils/format";
import { CategoryChip } from "./CategoryChip";
import { OtherCategorySheet } from "./OtherCategorySheet";

type Props = {
  tx: Transaction;
  open: boolean;
  onToggle: () => void;
  onCategorize: (cat: string, sub: string | null) => void;
  onShare: (cat: string, sub: string | null, description: string) => void;
  onFinishTier: (tier: Extract<Tier, "Income" | "Investment">) => void;
};

const TIERS: Tier[] = ["Income", "Purchase", "Investment"];

function plainChip(active: boolean) {
  return active ? { bg: "#000", fg: "#fff" } : { bg: "#fff", fg: "#000" };
}

export function InboxRow({ tx, open, onToggle, onCategorize, onShare, onFinishTier }: Props) {
  const [tier, setTier] = useState<Tier | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [hayat, setHayat] = useState(false);
  const [hayatDesc, setHayatDesc] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [subOptions, setSubOptions] = useState<string[]>([]);
  const [addingSub, setAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");

  // Reset local labeling state whenever the row opens or closes. Purchase is
  // the default tier — it's the overwhelmingly common case for a bank feed.
  useEffect(() => {
    if (open) {
      setTier("Purchase");
      setCat(null);
      setSub(null);
      setHayat(false);
      setHayatDesc("");
      setOtherOpen(false);
      setAddingSub(false);
      setNewSubName("");
    }
  }, [open]);

  // Real subcategory suggestions for the selected major, fetched from the
  // API's live data instead of the old SUBS mock. GET /api/categories
  // returns every major with its subcategories already loaded; filter down
  // to the one the user picked.
  useEffect(() => {
    setAddingSub(false);
    setNewSubName("");
    if (!cat || cat === "Other") {
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
  }, [cat]);

  const done = open && cat ? colorForCategory(cat) : null;
  const btnBg = done || (open ? "#000" : "#fff");
  const btnFg = done ? fg(done) : open ? "#fff" : "#000";

  const showCats = tier === "Purchase";
  const showTierOnly = tier === "Income" || tier === "Investment";
  const showSubs = !!cat && cat !== "Other";
  const showShared = !!cat;

  const finish = () => onCategorize(cat!, sub);
  const finishShared = () => onShare(cat!, sub, hayatDesc);
  const finishTierOnly = () => onFinishTier(tier as "Income" | "Investment");

  return (
    <div className="relative" style={{ borderTop: "2px solid #000", padding: "14px 0" }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="uppercase"
            style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".14em", color: "rgba(0,0,0,.62)", marginBottom: 4 }}
          >
            {tx.date}
          </div>
          <div style={{ font: "700 15px/1.25 Archivo", letterSpacing: "-.01em" }}>{tx.desc}</div>
        </div>
        <div className="flex-none text-right">
          <div style={{ font: "800 19px Archivo", fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }}>
            {moneySigned(tx.amt)}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="mt-[9px] inline-flex items-center justify-center uppercase"
            style={{ height: 36, padding: "0 13px", border: "2px solid #000", background: btnBg, color: btnFg, font: "800 11.5px Archivo", letterSpacing: ".08em" }}
          >
            {open ? "Close" : "Label"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3.5" style={{ background: "#f5f4f1", padding: 16 }}>
          <div
            className="mb-2 uppercase"
            style={{ font: "700 9.5px 'Space Mono', monospace", letterSpacing: ".18em", color: "rgba(0,0,0,.62)" }}
          >
            Type
          </div>
          <div className="mb-[22px] flex" style={{ border: "2px solid #000" }}>
            {TIERS.map((t, i) => {
              const chip = plainChip(tier === t);
              return (
                <div
                  key={t}
                  onClick={() => {
                    setTier(t);
                    setCat(null);
                    setSub(null);
                    setHayat(false);
                  }}
                  className="grid flex-1 cursor-pointer place-items-center uppercase"
                  style={{ minHeight: 44, background: chip.bg, color: chip.fg, borderLeft: i ? "2px solid #000" : "none", font: "800 12px Archivo", letterSpacing: ".06em" }}
                >
                  {t}
                </div>
              );
            })}
          </div>

          {showTierOnly && (
            <button
              type="button"
              onClick={finishTierOnly}
              className="grid w-full place-items-center uppercase"
              style={{ height: 46, background: "#000", color: "#fff", font: "800 12px Archivo", letterSpacing: ".06em" }}
            >
              Done
            </button>
          )}

          {showCats && (
            <div>
              <div
                className="mb-2 uppercase"
                style={{ font: "700 9.5px 'Space Mono', monospace", letterSpacing: ".18em", color: "rgba(0,0,0,.62)" }}
              >
                Category
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATS.map((n) => (
                  <CategoryChip
                    key={n}
                    name={n}
                    active={cat === n}
                    onClick={() => {
                      setCat(n);
                      setSub(null);
                      if (n === "Other") setOtherOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {showSubs && (
            <div className="mt-5">
              <div
                className="mb-2"
                style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(0,0,0,.62)" }}
              >
                Subcategory  
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subOptions.map((n, i) => {
                  const active = sub === n;
                  const subColor = colorForSubcategory(cat!, i);
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
                {!addingSub && (
                  <div
                    onClick={() => setAddingSub(true)}
                    className="flex cursor-pointer items-center gap-1.5"
                    style={{ minHeight: 34, padding: "0 11px", border: "1.5px dashed rgba(0,0,0,.35)", font: "500 13px Archivo", color: "rgba(0,0,0,.6)" }}
                  >
                    <i className="ph-bold ph-plus" style={{ fontSize: 12 }} />
                    New
                  </div>
                )}
              </div>

              {addingSub && (
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const name = newSubName.trim();
                        if (!name) return;
                        setSubOptions((prev) => (prev.includes(name) ? prev : [...prev, name]));
                        setSub(name);
                        setAddingSub(false);
                        setNewSubName("");
                      } else if (e.key === "Escape") {
                        setAddingSub(false);
                        setNewSubName("");
                      }
                    }}
                    placeholder="New subcategory name"
                    className="flex-1"
                    style={{ height: 34, border: "1.5px solid #000", padding: "0 10px", font: "500 13px Archivo" }}
                  />
                  <button
                    type="button"
                    disabled={!newSubName.trim()}
                    onClick={() => {
                      const name = newSubName.trim();
                      if (!name) return;
                      setSubOptions((prev) => (prev.includes(name) ? prev : [...prev, name]));
                      setSub(name);
                      setAddingSub(false);
                      setNewSubName("");
                    }}
                    className="grid place-items-center uppercase disabled:opacity-40"
                    style={{ height: 34, padding: "0 12px", background: "#000", color: "#fff", font: "800 11px Archivo", letterSpacing: ".06em" }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSub(false);
                      setNewSubName("");
                    }}
                    className="grid place-items-center uppercase"
                    style={{ height: 34, padding: "0 10px", border: "1.5px solid rgba(0,0,0,.3)", font: "800 11px Archivo", letterSpacing: ".06em", color: "rgba(0,0,0,.6)" }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {showShared && (
            <div className="mt-[22px] pt-4" style={{ borderTop: "1.5px solid rgba(0,0,0,.2)" }}>
              {hayat ? (
                <div>
                  <div className="mb-3.5 flex items-center gap-2">
                    <span
                      className="uppercase"
                      style={{ background: "#17BEBB", padding: "3px 8px", font: "700 10px 'Space Mono', monospace", letterSpacing: ".14em" }}
                    >
                      Hayat
                    </span>
                    <span style={{ font: "500 12px Archivo", color: "rgba(0,0,0,.55)" }}>
                      writes one row to the shared sheet, 50/50
                    </span>
                  </div>
                  <div
                    className="mb-1 uppercase"
                    style={{ font: "400 9.5px 'Space Mono', monospace", letterSpacing: ".14em", color: "rgba(0,0,0,.62)" }}
                  >
                    Description (short)
                  </div>
                  <input
                    autoFocus
                    value={hayatDesc}
                    onChange={(e) => setHayatDesc(e.target.value)}
                    placeholder="e.g. TJ run"
                    className="mb-3.5 w-full"
                    style={{ height: 42, border: "1.5px solid rgba(0,0,0,.3)", background: "#fff", padding: "0 10px", font: "500 14px Archivo" }}
                  />
                  <button
                    type="button"
                    onClick={finishShared}
                    disabled={!hayatDesc.trim()}
                    className="grid w-full place-items-center uppercase disabled:opacity-40"
                    style={{ height: 48, background: "#000", color: "#fff", font: "800 13px Archivo", letterSpacing: ".1em" }}
                  >
                    Log &amp; file
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={finish}
                    className="grid flex-1 place-items-center uppercase"
                    style={{ height: 46, background: "#000", color: "#fff", font: "800 12px Archivo", letterSpacing: ".06em" }}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => setHayat(true)}
                    className="grid place-items-center uppercase"
                    style={{ height: 46, padding: "0 16px", border: "2px solid #000", background: "#17BEBB", font: "800 12px Archivo", letterSpacing: ".06em" }}
                  >
                    Shared?
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {otherOpen && <OtherCategorySheet desc={tx.desc} onClose={() => setOtherOpen(false)} />}
    </div>
  );
}
