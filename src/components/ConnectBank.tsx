import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

type Props = {
  onConnected: () => void;
  /** Text shown once the button is ready to click — lets callers say "Add bank" instead of "Connect bank" when one's already linked. */
  idleLabel?: string;
};

/** Fetches a Plaid Link token, opens Plaid Link, and exchanges the resulting public token on success. */
export function ConnectBank({ onConnected, idleLabel = "Connect bank" }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "connecting" | "error">("loading");

  useEffect(() => {
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.linkToken) {
          setLinkToken(data.linkToken);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string | null) => {
      if (!publicToken) return;
      setStatus("connecting");
      try {
        const exchangeRes = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken }),
        });
        if (!exchangeRes.ok) throw new Error("exchange failed");
        await fetch("/api/plaid/sync", { method: "POST" });
        onConnected();
      } catch {
        setStatus("error");
      }
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
  });

  const label =
    status === "loading" ? "Loading…" :
    status === "connecting" ? "Connecting…" :
    status === "error" ? "Try again" :
    idleLabel;

  return (
    <button
      type="button"
      onClick={() => (status === "error" ? window.location.reload() : open())}
      disabled={!ready && status !== "error"}
      className="flex w-full items-center justify-center gap-2 uppercase disabled:opacity-40"
      style={{ height: 48, border: "2px solid #000", background: "#17BEBB", font: "800 12.5px Archivo", letterSpacing: ".06em" }}
    >
      {label}
    </button>
  );
}
