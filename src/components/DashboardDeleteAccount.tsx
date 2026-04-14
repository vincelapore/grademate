"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

export function DashboardDeleteAccount() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/account", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" && json.error
            ? json.error
            : `Could not delete account (${res.status})`,
        );
      }
      posthog.capture("account_deleted");
      posthog.reset();
      setOpen(false);
      router.refresh();
      window.location.href = "/";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="gm-dash-modal-btn gm-dash-modal-btn--danger"
      >
        Delete account
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="gm-dash-modal-backdrop"
              onClick={() => !busy && setOpen(false)}
              role="presentation"
            >
              <div
                className="gm-dash-modal-panel gm-dash-modal-panel--sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-account-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="gm-dash-modal-body">
                  <h2
                    id="delete-account-title"
                    className="text-lg font-semibold text-[var(--color-text-primary)]"
                  >
                    Delete your account?
                  </h2>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    This permanently deletes your semesters, courses, and marks. This
                    cannot be undone.
                  </p>
                  {error ? (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
                <footer className="gm-dash-modal-footer">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setOpen(false)}
                    className="gm-dash-modal-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void doDelete()}
                    className="gm-dash-modal-btn gm-dash-modal-btn--danger"
                  >
                    {busy ? "Deleting…" : "Delete"}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

