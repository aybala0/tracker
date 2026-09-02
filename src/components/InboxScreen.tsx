import { useState } from "react";
import type { Tier, Transaction } from "../types";
import { InboxRow } from "./InboxRow";

type Props = {
  inbox: Transaction[];
  onCategorize: (id: string, cat: string, sub: string | null) => void;
  onShare: (id: string, cat: string, sub: string | null, description: string) => void;
  onFinishTier: (id: string, tier: Extract<Tier, "Income" | "Investment">) => void;
};

export function InboxScreen({ inbox, onCategorize, onShare, onFinishTier }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  // Rule-matched rows that already have a suggested cat come pre-labeled;
  // they get their own review section at the bottom instead of mixing in
  // with rows that still need a human decision.
  const pending = inbox.filter((t) => !(t.rule && t.cat));
  const matched = inbox.filter((t) => t.rule && t.cat);

  const reviewAll = () => {
    for (const t of matched) {
      onCategorize(t.id, t.cat!, t.sub ?? null);
    }
    setOpenId(null);
  };

  const renderRow = (t: Transaction, isMatched: boolean) => (
    <InboxRow
      key={t.id}
      tx={t}
      matched={isMatched}
      open={openId === t.id}
      onToggle={() => setOpenId(openId === t.id ? null : t.id)}
      onCategorize={(cat, sub) => {
        onCategorize(t.id, cat, sub);
        setOpenId(null);
      }}
      onShare={(cat, sub, description) => {
        onShare(t.id, cat, sub, description);
        setOpenId(null);
      }}
      onFinishTier={(tier) => {
        onFinishTier(t.id, tier);
        setOpenId(null);
      }}
    />
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-[22px] pb-3.5 pt-[18px]">
        <div className="uppercase" style={{ font: "900 30px/1 Archivo", letterSpacing: "-.03em" }}>
          Inbox
        </div>
        <div className="mt-[5px]" style={{ font: "500 12.5px Archivo", color: "rgba(0,0,0,.6)" }}>
          {inbox.length} uncategorized
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[22px] pb-[26px]">
        {pending.map((t) => renderRow(t, false))}
        {inbox.length === 0 ? (
          <div className="py-12 text-center" style={{ font: "500 13px Archivo", color: "rgba(0,0,0,.45)" }}>
            Nothing left to label.
          </div>
        ) : (
          matched.length > 0 && (
            <>
              <div style={{ height: 2, background: "#000" }} />
              <div className="mt-4 flex items-center justify-between gap-3">
                <div style={{ font: "500 12px Archivo", color: "rgba(0,0,0,.5)" }}>
                  Rules matched {matched.length} of these before you woke up.
                </div>
                <button
                  type="button"
                  onClick={reviewAll}
                  className="inline-flex flex-none items-center justify-center uppercase"
                  style={{ height: 34, padding: "0 14px", border: "2px solid #000", background: "#000", color: "#fff", font: "800 11px Archivo", letterSpacing: ".08em" }}
                >
                  Review all
                </button>
              </div>
              <div className="mt-2">{matched.map((t) => renderRow(t, true))}</div>
            </>
          )
        )}
      </div>
    </div>
  );
}
