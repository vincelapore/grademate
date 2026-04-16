"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getCurrentSemester } from "@/lib/semester";
import { UpgradeModal } from "@/components/UpgradeModal";

const PERIOD_OPTIONS = [
  "Semester 1",
  "Semester 2",
  "Trimester 1",
  "Trimester 2",
  "Trimester 3",
  "Summer",
  "Winter",
] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

export function AddSemesterModal({ onClose }: { onClose: () => void }) {
  const current = useMemo(() => getCurrentSemester(), []);
  const inferredYear = new Date().getFullYear() || current.year;
  const inferredPeriod: Period =
    current.semester === "Semester 2" ? "Semester 2" : "Semester 1";
  const [year, setYear] = useState<number>(inferredYear);
  const [period, setPeriod] = useState<Period>(inferredPeriod);
  const [isCurrent, setIsCurrent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const yearValid = Number.isFinite(year) && year >= 2000 && year <= 2100;
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const max = now + 2;
    const min = 2000;
    const out: number[] = [];
    for (let y = max; y >= min; y--) out.push(y);
    return out;
  }, []);

  async function createSemester() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/semester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto: false,
          year,
          period,
          is_current: isCurrent,
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
      const id =
        typeof jsonUnknown === "object" &&
        jsonUnknown != null &&
        "id" in jsonUnknown
          ? String((jsonUnknown as { id: unknown }).id)
          : null;
      window.location.href = id
        ? `/dashboard?view=semester&sid=${encodeURIComponent(id)}`
        : "/dashboard?view=semester";
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
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label className="gm-dash-field-label" htmlFor="gm-add-sem-year">
                  Year
                </label>
                <select
                  id="gm-add-sem-year"
                  className="gm-dash-select"
                  value={String(year)}
                  onChange={(e) => setYear(Number(e.target.value))}
                  disabled={saving}
                  autoFocus
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label className="gm-dash-field-label" htmlFor="gm-add-sem-period">
                  Period
                </label>
                <select
                  id="gm-add-sem-period"
                  className="gm-dash-select"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                  disabled={saving}
                >
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
                {period}, <strong>{yearValid ? year : inferredYear}</strong>
              </div>

              <label
                className="gm-settings-row"
                style={{
                  marginTop: 2,
                  padding: 0,
                  border: "none",
                }}
              >
                <div className="gm-settings-row-left">
                  <div className="gm-settings-row-title">
                    Is this your current semester?
                  </div>
                  <div className="gm-settings-row-sub">
                    Turn this off if you’re adding a past semester.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  disabled={saving}
                  aria-label="Is this your current semester?"
                />
              </label>
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
              disabled={saving || !yearValid}
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

