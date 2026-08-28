import { useState } from "react";

type Props = {
  onLogin: (password: string) => Promise<string | null>;
};

export function LoginScreen({ onLogin }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await onLogin(password);
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6" style={{ fontFamily: "Archivo, sans-serif" }}>
      <form onSubmit={handleSubmit} className="w-full" style={{ maxWidth: 340 }}>
        <div className="mb-1 uppercase" style={{ font: "900 30px/1 Archivo", letterSpacing: "-.03em" }}>
          Finance Tracker
        </div>
        <div className="mb-6" style={{ font: "500 13px Archivo", color: "rgba(0,0,0,.6)" }}>
          Enter the app password to continue.
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mb-3 w-full"
          style={{ height: 48, border: "2px solid #000", padding: "0 14px", font: "600 15px Archivo" }}
        />
        {error && (
          <div className="mb-3" style={{ font: "600 12.5px Archivo", color: "#F2188F" }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !password}
          className="grid w-full place-items-center uppercase disabled:opacity-40"
          style={{ height: 48, background: "#000", color: "#fff", font: "800 13px Archivo", letterSpacing: ".08em" }}
        >
          {submitting ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
