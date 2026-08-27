import type { NavTarget } from "../types";

const TABS: { name: NavTarget; icon: string }[] = [
  { name: "Home", icon: "ph-bold ph-squares-four" },
  { name: "Inbox", icon: "ph-bold ph-tray" },
  { name: "Categories", icon: "ph-bold ph-tag" },
  { name: "Analysis", icon: "ph-bold ph-chart-bar" },
];

type Props = {
  active: NavTarget;
  onNavigate: (tab: NavTarget) => void;
  inboxCount: number;
};

export function BottomNav({ active, onNavigate, inboxCount }: Props) {
  return (
    <div className="flex border-t-2 border-black px-2 pt-1.5 pb-6">
      {TABS.map((tab) => {
        const isActive = tab.name === active;
        const showBadge = tab.name === "Inbox" && !isActive && inboxCount > 0;
        return (
          <button
            key={tab.name}
            type="button"
            onClick={() => onNavigate(tab.name)}
            className="relative flex flex-1 flex-col items-center gap-1 py-2"
            style={{ color: isActive ? "#000" : "rgba(0,0,0,.4)" }}
          >
            <i className={tab.icon} style={{ fontSize: 21 }} />
            <span
              className="uppercase"
              style={{ font: "400 9px 'Space Mono', monospace", letterSpacing: ".1em" }}
            >
              {tab.name}
            </span>
            {showBadge && (
              <span
                className="absolute grid place-items-center text-white"
                style={{
                  top: 2,
                  right: 22,
                  minWidth: 18,
                  height: 18,
                  background: "#F2188F",
                  font: "800 10px Archivo",
                  padding: "0 4px",
                }}
              >
                {inboxCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
