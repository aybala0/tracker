import { useCallback, useEffect, useState } from "react";

export function useBankStatus() {
  const [linked, setLinked] = useState<boolean | null>(null); // null = still checking
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/accounts/status")
      .then((res) => res.json())
      .then((data) => {
        setLinked(!!data.linked);
        setLastSyncedAt(data.lastSyncedAt ?? null);
      })
      .catch(() => setLinked(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { linked, lastSyncedAt, refresh };
}
