import { useState } from "react";
import type { NavTarget } from "./types";
import { useAuth } from "./hooks/useAuth";
import { useTransactions } from "./hooks/useTransactions";
import { useBankStatus } from "./hooks/useBankStatus";
import { LoginScreen } from "./components/LoginScreen";
import { ConnectBank } from "./components/ConnectBank";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import { InboxScreen } from "./components/InboxScreen";
import { CategoriesScreen } from "./components/CategoriesScreen";
import { AnalysisScreen } from "./components/AnalysisScreen";

export default function App() {
  const { authenticated, login } = useAuth();
  const [tab, setTab] = useState<NavTarget>("Home");
  const { linked, lastSyncedAt, institutions, refresh } = useBankStatus();
  const { inbox, categorize, share, categorizeTier } = useTransactions();

  if (authenticated === null) {
    return <div className="min-h-screen bg-white" />;
  }
  if (!authenticated) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-white" style={{ fontFamily: "Archivo, sans-serif" }}>
      {tab === "Home" && linked !== null && (
        <div className="px-[22px] pt-5">
          {linked ? (
            <div className="flex items-center justify-between">
              <div style={{ font: "600 12px Archivo", color: "rgba(0,0,0,.55)" }}>
                Connected: {institutions.join(", ") || "1 bank"}
              </div>
              <ConnectBank onConnected={refresh} idleLabel="Add bank" compact />
            </div>
          ) : (
            <ConnectBank onConnected={refresh} idleLabel="Connect bank" />
          )}
        </div>
      )}
      {tab === "Home" && <HomeScreen inboxCount={inbox.length} onNavigate={setTab} lastSyncedAt={lastSyncedAt} />}
      {tab === "Inbox" && (
        <InboxScreen inbox={inbox} onCategorize={categorize} onShare={share} onFinishTier={categorizeTier} />
      )}
      {tab === "Categories" && <CategoriesScreen />}
      {tab === "Analysis" && <AnalysisScreen />}

      <BottomNav active={tab} onNavigate={setTab} inboxCount={inbox.length} />
    </div>
  );
}
