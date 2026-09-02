import { useNetWorth } from "../hooks/useNetWorth";
import { useMonthSummary } from "../hooks/useMonthSummary";
import { useCategoryTotals } from "../hooks/useCategoryTotals";
import { PieChart } from "./PieChart";
import { slices } from "../utils/pie";
import { short } from "../utils/format";
import type { NavTarget } from "../types";

type Props = {
  inboxCount: number;
  onNavigate: (tab: NavTarget) => void;
  lastSyncedAt: string | null;
};

function fmtSigned(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `−$${abs}` : `$${abs}`;
}

function fmtSyncedAgo(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Synced ${days}d ago`;
}

const CURRENT_MONTH_LABEL = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
const TODAY_LABEL = new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

export function HomeScreen({ inboxCount, onNavigate, lastSyncedAt }: Props) {
  const { net, checking, cards } = useNetWorth();
  const { thisMonth, average, percentBelow, fillPct, avgLinePct, dayOfMonth } = useMonthSummary();
  const totals = useCategoryTotals(CURRENT_MONTH_LABEL);
  const { out } = slices(totals, 92, 100, 100, null, false);
  const legend = out.slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto px-[22px] pb-[26px] pt-5">
      <div className="mb-[22px] flex items-center justify-between">
        <div className="uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em" }}>
          {TODAY_LABEL}
        </div>
        <div
          className="flex items-center gap-1.5 uppercase"
          style={{ font: "700 9.5px 'Space Mono', monospace", letterSpacing: ".14em", color: "#0E7C7B" }}
        >
          <span style={{ width: 7, height: 7, background: "#17BEBB" }} />
          {fmtSyncedAgo(lastSyncedAt)}
        </div>
      </div>

      {/* Net worth */}
      <div className="mb-[22px] pb-[22px] pt-5" style={{ color: "#fff" }}>
        <div
          className="mb-2.5 uppercase"
          style={{ font: "700 10.5px Archivo", letterSpacing: ".16em", color: "#2d2b2b" }}
        >
          Net amount you own
        </div>
        <div style={{ font: "900 52px/1 Archivo", letterSpacing: "-.035em", fontVariantNumeric: "tabular-nums", color: "#000" }}>
          ${net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div
          className="mt-[18px] flex gap-0 pt-3.5"
          style={{ borderTop: "1px solid rgba(255,255,255,.25)" }}
        >
          <div className="flex-1">
            <div className="uppercase" style={{ font: "600 10px Archivo", letterSpacing: ".12em", color: "#2d2b2b" }}>
              Checking
            </div>
            <div style={{ font: "700 17px Archivo", fontVariantNumeric: "tabular-nums", color: "#2d2b2b" }}>
              ${checking.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex-1">
            <div className="uppercase" style={{ font: "600 10px Archivo", letterSpacing: ".12em", color: "#2d2b2b" }}>
              Cards
            </div>
            <div style={{ font: "700 17px Archivo", fontVariantNumeric: "tabular-nums", color: "#2d2b2b" }}>
              {fmtSigned(cards)}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-2 uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em" }}>
        This month
      </div>
      <div className="mb-3 flex items-end gap-3">
        <div style={{ font: "900 42px/1 Archivo", letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums" }}>
          ${thisMonth.toLocaleString("en-US")}
        </div>
        <div className="pb-1" style={{ font: "600 12.5px/1.3 Archivo" }}>
          <span style={{ background: "#78C247", padding: "2px 6px" }}>{percentBelow}% below</span>
          <br />
          <span style={{ color: "rgba(0,0,0,.55)", fontWeight: 500 }}>
            day-{dayOfMonth} average of ${average.toLocaleString("en-US")}
          </span>
        </div>
      </div>
      <div className="relative mb-[30px]" style={{ height: 14, border: "2px solid #000" }}>
        <div style={{ position: "absolute", inset: 0, right: `${100 - fillPct}%`, background: "#78C247" }} />
        <div
          style={{
            position: "absolute",
            top: -6,
            bottom: -6,
            left: `${avgLinePct}%`,
            width: 2,
            background: "#000",
          }}
        />
        <div
          className="whitespace-nowrap uppercase"
          style={{
            position: "absolute",
            top: -19,
            left: `${avgLinePct}%`,
            transform: "translateX(-50%)",
            font: "400 8.5px 'Space Mono', monospace",
            letterSpacing: ".1em",
            color: "rgba(0,0,0,.62)",
          }}
        >
          avg
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="uppercase" style={{ font: "700 10px 'Space Mono', monospace", letterSpacing: ".16em" }}>
          Where it went
        </div>
        <button
          type="button"
          onClick={() => onNavigate("Categories")}
          className="uppercase"
          style={{ font: "700 11.5px Archivo", letterSpacing: ".06em", color: "#F2188F" }}
        >
          Categories →
        </button>
      </div>
      <div className="mb-7 flex items-center gap-[18px]">
        <PieChart data={totals} r={92} cx={100} cy={100} viewBoxSize={200} size={146} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {legend.map((l) => (
            <div key={l.name} className="flex items-center gap-2" style={{ font: "500 12.5px Archivo" }}>
              <span style={{ width: 11, height: 11, flexShrink: 0, background: l.color, border: "1.5px solid #000" }} />
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{l.name}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{short(l.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate("Inbox")}
        className="flex w-full items-center gap-3 p-4 text-left"
        style={{ border: "2px solid #000" }}
      >
        <div className="flex-1">
          <div style={{ font: "800 17px Archivo", letterSpacing: "-.01em" }}>{inboxCount} to categorize</div>
        </div>
        <div
          className="grid place-items-center uppercase"
          style={{ background: "#F2188F", color: "#fff", font: "800 13px Archivo", letterSpacing: ".04em", padding: "0 16px", height: 44 }}
        >
          Open
        </div>
      </button>
    </div>
  );
}
