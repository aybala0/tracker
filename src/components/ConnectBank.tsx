import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

type Props = {
  onConnected: () => void;
  /** Text shown once the button is ready to click — lets callers say "Add bank" instead of "Connect bank" when one's already linked. */
  idleLabel?: string;
  /** Smaller, secondary styling for when a bank is already connected — this is an "add another," not a prompt to fix something. */
  compact?: boolean;
};

/** Fetches a Plaid Link token, opens Plaid Link, and exchanges the resulting public token on success. */
export function ConnectBank({ onConnected, idleLabel = "Connect bank", compact = false }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "connecting" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(null);
      try {
        const exchangeRes = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken }),
        });
        if (!exchangeRes.ok) {
          const data = await exchangeRes.json().catch(() => null);
          throw new Error(data?.error ?? "exchange failed");
        }
        await fetch("/api/plaid/sync", { method: "POST" });
        onConnected();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : null);
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
    <div>
      <button
        type="button"
        onClick={() => (status === "error" ? window.location.reload() : open())}
        disabled={!ready && status !== "error"}
        className={compact ? "uppercase disabled:opacity-40" : "flex w-full items-center justify-center gap-2 uppercase disabled:opacity-40"}
        style={
          compact
            ? { font: "700 11.5px Archivo", letterSpacing: ".06em", color: "rgba(0,0,0,.55)", textDecoration: "underline" }
            : { height: 48, border: "2px solid #000", background: "#17BEBB", font: "800 12.5px Archivo", letterSpacing: ".06em" }
        }
      >
        {compact ? `+ ${label}` : label}
      </button>
      {errorMessage && (
        <div className="mt-2" style={{ font: "500 12px Archivo", color: "#F2188F" }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
