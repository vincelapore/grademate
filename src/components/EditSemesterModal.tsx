"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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

export function EditSemesterModal({
  semesterId,
  initialYear,
  initialPeriod,
  initialIsCurrent,
  onClose,
  onDeleted,
}: {
  semesterId: string;
  initialYear: number;
  initialPeriod: Period;
  initialIsCurrent: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const inferredYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState<number>(initialYear || inferredYear);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [isCurrent, setIsCurrent] = useState<boolean>(initialIsCurrent);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearValid = Number.isFinite(year) && year >= 2000 && year <= 2100;
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    const max = now + 2;
    const min = 2000;
    const out: number[] = [];
    for (let y = max; y >= min; y--) out.push(y);
    return out;
  }, []);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/dashboard/semesters/${encodeURIComponent(semesterId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ year, period, is_current: isCurrent }),
        },
      );
      const jsonUnknown: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof jsonUnknown === "object" &&
          jsonUnknown != null &&
          "error" in jsonUnknown
            ? String((jsonUnknown as { error: unknown }).error)
            : "Could not save semester.";
        throw new Error(msg);
      }
      onClose();
      window.location.href = "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save semester.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSemester() {
    if (!confirm("Delete this semester and all its courses + assessments?"))
      return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/dashboard/semesters/${encodeURIComponent(semesterId)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const jsonUnknown: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof jsonUnknown === "object" &&
          jsonUnknown != null &&
          "error" in jsonUnknown
            ? String((jsonUnknown as { error: unknown }).error)
            : "Could not delete semester.";
        throw new Error(msg);
      }
      onClose();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete semester.");
    } finally {
      setDeleting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="gm-dash-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="gm-dash-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-edit-semester-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gm-dash-modal-header">
          <h2
            id="gm-edit-semester-title"
            className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
          >
            Semester settings
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
              <label className="gm-dash-field-label" htmlFor="gm-edit-sem-year">
                Year
              </label>
              <select
                id="gm-edit-sem-year"
                className="gm-dash-select"
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                disabled={saving || deleting}
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
              <label
                className="gm-dash-field-label"
                htmlFor="gm-edit-sem-period"
              >
                Period
              </label>
              <select
                id="gm-edit-sem-period"
                className="gm-dash-select"
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                disabled={saving || deleting}
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
                  Turning this on will unset any previous current semester.
                </div>
              </div>
              <input
                type="checkbox"
                checked={isCurrent}
                onChange={(e) => setIsCurrent(e.target.checked)}
                disabled={saving || deleting}
                aria-label="Is this your current semester?"
              />
            </label>
          </div>

          {error ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13,
                color: "var(--color-text-secondary)",
              }}
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <footer
          className="gm-dash-modal-footer"
          style={{ justifyContent: "space-between" }}
        >
          <button
            type="button"
            className="gm-dash-btn"
            onClick={() => void deleteSemester()}
            disabled={saving || deleting}
            style={{
              color: "rgb(220, 38, 38)",
              borderColor:
                "color-mix(in srgb, rgb(220, 38, 38) 35%, transparent)",
            }}
          >
            {deleting ? "Deleting…" : "Delete semester"}
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="gm-dash-btn"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="gm-dash-btn"
              onClick={() => void save()}
              disabled={saving || deleting || !yearValid}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
