"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardCalendarReset() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (
      !window.confirm(
        "This will break any existing calendar subscriptions. Continue?",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/calendar-token", {
        method: "POST",
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : "Could not reset link";
        setError(msg);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="gm-dash-btn"
        disabled={busy}
        onClick={() => void reset()}
      >
        {busy ? "Resetting…" : "Reset calendar link"}
      </button>
      {error ? (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
