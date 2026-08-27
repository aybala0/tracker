import { useState } from "react";
import type { NavTarget } from "./types";
import { useTransactions } from "./hooks/useTransactions";
import { BottomNav } from "./components/BottomNav";
import { HomeScreen } from "./components/HomeScreen";
import { InboxScreen } from "./components/InboxScreen";
import { CategoriesScreen } from "./components/CategoriesScreen";
import { AnalysisScreen } from "./components/AnalysisScreen";

export default function App() {
  const [tab, setTab] = useState<NavTarget>("Home");
  const { inbox, categorize } = useTransactions();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-white" style={{ fontFamily: "Archivo, sans-serif" }}>
      {tab === "Home" && <HomeScreen inboxCount={inbox.length} onNavigate={setTab} />}
      {tab === "Inbox" && <InboxScreen inbox={inbox} onCategorize={categorize} />}
      {tab === "Categories" && <CategoriesScreen />}
      {tab === "Analysis" && <AnalysisScreen />}

      <BottomNav active={tab} onNavigate={setTab} inboxCount={inbox.length} />
    </div>
  );
}
