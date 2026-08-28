import { useState } from "react";
import type { Transaction } from "../types";
import { InboxRow } from "./InboxRow";

type Props = {
  inbox: Transaction[];
  onCategorize: (id: string, cat: string, sub: string | null) => void;
  onShare: (id: string, cat: string, sub: string | null, description: string) => void;
};

export function InboxScreen({ inbox, onCategorize, onShare }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const oldest = inbox[inbox.length - 1];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-[22px] pb-3.5 pt-[18px]">
        <div className="uppercase" style={{ font: "900 30px/1 Archivo", letterSpacing: "-.03em" }}>
          Inbox
        </div>
        <div className="mt-[5px]" style={{ font: "500 12.5px Archivo", color: "rgba(0,0,0,.6)" }}>
          {inbox.length} uncategorized{oldest ? ` · oldest ${oldest.date}` : ""}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[22px] pb-[26px]">
        {inbox.map((t) => (
          <InboxRow
            key={t.id}
            tx={t}
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
          />
        ))}
        {inbox.length === 0 ? (
          <div className="py-12 text-center" style={{ font: "500 13px Archivo", color: "rgba(0,0,0,.45)" }}>
            Nothing left to label.
          </div>
        ) : (
          <>
            <div style={{ height: 2, background: "#000" }} />
            <div className="mt-4" style={{ font: "500 12px Archivo", color: "rgba(0,0,0,.5)" }}>
              Rules matched 3 of these before you woke up.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
