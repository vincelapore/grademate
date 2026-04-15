"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getCurrentSemester } from "@/lib/semester";
import { UpgradeModal } from "@/components/UpgradeModal";

const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"] as const;

export function AddSemesterModal({ onClose }: { onClose: () => void }) {
  const current = useMemo(() => getCurrentSemester(), []);
  const inferredYear = current.year;
  const inferredSemester: (typeof SEMESTER_OPTIONS)[number] =
    current.semester === "Semester 2" ? "Semester 2" : "Semester 1";
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function createSemester() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/semester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto: true,
          year: inferredYear,
          semester: inferredSemester,
          name,
        }),
      });
      const jsonUnknown: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof jsonUnknown === "object" &&
          jsonUnknown != null &&
          "error" in jsonUnknown
            ? String((jsonUnknown as { error: unknown }).error)
            : "Could not create semester.";
        if (res.status === 402) {
          setShowUpgrade(true);
        } else {
          setError(msg);
        }
        return;
      }
      window.location.href = "/dashboard?view=semester";
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="gm-dash-modal-backdrop"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="gm-dash-modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gm-add-semester-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="gm-dash-modal-header">
            <h2
              id="gm-add-semester-title"
              className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
            >
              Add semester
            </h2>
            <button
              type="button"
              className="gm-dash-modal-close"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </header>

          <div className="gm-dash-modal-body">
            <div style={{ display: "grid", gap: 6 }}>
              <label className="gm-dash-field-label" htmlFor="gm-add-sem-name">
                Name
              </label>
              <input
                id="gm-add-sem-name"
                className="gm-dash-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Year 1 · Sem 1"
                disabled={saving}
                autoFocus
              />
            </div>

            {error ? (
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }} role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="gm-dash-modal-footer">
            <button
              type="button"
              className="gm-dash-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="gm-dash-btn"
              onClick={() => void createSemester()}
              disabled={saving || !name.trim()}
            >
              {saving ? "Creating…" : "Create semester"}
            </button>
          </footer>
        </div>
      </div>
      {showUpgrade ? (
        <UpgradeModal
          reason="semesters"
          onClose={() => {
            setShowUpgrade(false);
            onClose();
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}

