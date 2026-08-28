import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null); // null = still checking

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      setAuthenticated(res.ok);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (password: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthenticated(true);
        return null;
      }
      const data = await res.json().catch(() => null);
      return data?.error ?? "Login failed.";
    } catch {
      return "Could not reach the server.";
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
  }, []);

  return { authenticated, login, logout };
}
