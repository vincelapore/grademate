"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { ProPriceTier } from "@/lib/stripePriceIds";

export function ProCheckoutButton({
  tier,
  className,
  style,
  children,
}: {
  tier: ProPriceTier;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const raw = await res.text();
      let data: unknown = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      const url =
        typeof data === "object" &&
        data != null &&
        "url" in data &&
        typeof (data as { url: unknown }).url === "string"
          ? (data as { url: string }).url
          : null;

      let message = "Could not start checkout.";
      if (typeof data === "object" && data != null && "error" in data) {
        const errField = (data as { error: unknown }).error;
        if (typeof errField === "string") message = errField;
        else if (
          typeof errField === "object" &&
          errField != null &&
          "message" in errField &&
          typeof (errField as { message: unknown }).message === "string"
        ) {
          message = (errField as { message: string }).message;
        }
      } else if (!res.ok && raw && raw.length < 400) {
        message = raw;
      } else if (!res.ok) {
        message = `Checkout failed (HTTP ${res.status}). Check the Network tab for /api/stripe/checkout.`;
      }

      if (!res.ok || !url) {
        setError(message);
        return;
      }
      window.location.href = url;
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "100%" }}>
      <button
        type="button"
        className={className}
        style={style}
        disabled={busy}
        onClick={() => void startCheckout()}
      >
        {busy ? "Redirecting…" : children}
      </button>
      {error ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
