"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { SemesterType } from "@/lib/semester";
import { CourseLimitModal } from "@/components/CourseLimitModal";
import { ScraperAddCourse } from "@/components/ScraperAddCourse";

function normalizeFreeformCode(name: string): string {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .join("-");
  const base = cleaned.slice(0, 16) || "FREEFORM";
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${base}-${suffix}`;
}

export function AddCourseModal({
  plan,
  semesterId,
  year,
  semesterLabel,
  university = "uq",
  lockedMode,
  lockedUniversity,
  lockedYear,
  lockedSemester,
  existingCourseCount,
  onClose,
}: {
  plan: "free" | "pro";
  semesterId: string;
  year: number;
  semesterLabel: SemesterType;
  university?: "uq" | "qut";
  lockedMode?: "freeform" | "scraper" | null;
  lockedUniversity?: "uq" | "qut" | null;
  lockedYear?: number | null;
  lockedSemester?: SemesterType | null;
  existingCourseCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const maxCourses = plan === "pro" ? 999 : 4;
  const nowYear = new Date().getFullYear();

  const inferredLockedMode: "freeform" | "scraper" | null =
    lockedMode === "freeform" || lockedMode === "scraper"
      ? lockedMode
      : existingCourseCount > 0
        ? "scraper"
        : null;

  const effectiveLockedUni =
    lockedUniversity ?? (inferredLockedMode === "scraper" ? university : null);
  const effectiveLockedYear =
    lockedYear ?? (inferredLockedMode === "scraper" ? year : null);
  const effectiveLockedSemester =
    lockedSemester ??
    (inferredLockedMode === "scraper" ? semesterLabel : null);

  const isLocked = inferredLockedMode != null;

  const [step, setStep] = useState<"choose" | "freeform" | "scraper">(
    inferredLockedMode === "freeform"
      ? "freeform"
      : inferredLockedMode === "scraper"
        ? "scraper"
        : "choose",
  );

  const [freeformName, setFreeformName] = useState("");
  const [freeformSaving, setFreeformSaving] = useState(false);
  const [freeformError, setFreeformError] = useState<string | null>(null);

  const freeformValid = useMemo(() => {
    const name = freeformName.trim();
    return name.length >= 3;
  }, [freeformName]);

  const [showLimit, setShowLimit] = useState(
    plan === "free" && existingCourseCount >= 4,
  );

  if (showLimit) {
    return (
      <CourseLimitModal
        onClose={() => {
          setShowLimit(false);
          onClose();
        }}
      />
    );
  }

  if (typeof document === "undefined") return null;

  async function saveFreeform() {
    setFreeformError(null);
    setFreeformSaving(true);
    try {
      const courseName = freeformName.trim();
      const courseCode = normalizeFreeformCode(courseName);
      const payload = {
        semesterId,
        context: { mode: "freeform" },
        courses: [
          {
            courseCode,
            courseName,
            creditPoints: 2,
            targetGrade: 7,
            assessments: [],
          },
        ],
      };
      const res = await fetch("/api/onboarding/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const jsonUnknown: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof jsonUnknown === "object" &&
          jsonUnknown != null &&
          "error" in jsonUnknown
            ? String((jsonUnknown as { error: unknown }).error)
            : "Could not save course.";
        throw new Error(msg);
      }
      onClose();
      router.refresh();
    } catch (e) {
      setFreeformError(e instanceof Error ? e.message : "Could not save course.");
    } finally {
      setFreeformSaving(false);
    }
  }

  return createPortal(
    <div
      className="gm-dash-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="gm-dash-modal-panel gm-dash-modal-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-dash-add-course-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gm-dash-modal-header">
          <h2
            id="gm-dash-add-course-title"
            className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
          >
            Add course
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
        <div className="gm-dash-modal-body pb-6">
          {step === "choose" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p className="gm-dash-add-course-helper">
                Choose how you want to add courses for this semester. We’ll lock
                it after the first course to keep things consistent.
              </p>
              <div className="gm-dash-add-course-choice-grid">
                <button
                  type="button"
                  className="gm-dash-choice-card"
                  onClick={() => setStep("freeform")}
                >
                  <div className="gm-dash-choice-card-title">Freeform</div>
                  <div className="gm-dash-choice-card-desc">
                    Add a custom course name manually.
                  </div>
                </button>

                <button
                  type="button"
                  className="gm-dash-choice-card"
                  onClick={() => setStep("scraper")}
                >
                  <div className="gm-dash-choice-card-title">Scraper</div>
                  <div className="gm-dash-choice-card-desc">
                    Pick uni + term, then search by course code.
                  </div>
                </button>
              </div>
            </div>
          ) : step === "scraper" ? (
            <ScraperAddCourse
              semesterId={semesterId}
              defaultYear={year}
              defaultSemesterLabel={semesterLabel}
              lockedUniversity={(effectiveLockedUni ?? null) as "uq" | null}
              lockedYear={effectiveLockedYear}
              lockedSemester={effectiveLockedSemester}
              isLocked={isLocked}
              existingCourseCount={existingCourseCount}
              maxCourses={maxCourses}
              onBack={!isLocked ? () => setStep("choose") : undefined}
              onDone={() => {
                onClose();
                router.refresh();
              }}
            />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {!isLocked ? (
                <button
                  type="button"
                  className="gm-dash-add-course-btn-back"
                  onClick={() => setStep("choose")}
                >
                  ← Back
                </button>
              ) : null}

              <div style={{ display: "grid", gap: 6 }}>
                <label className="gm-dash-field-label" htmlFor="gm-free-code">
                  Course name
                </label>
                <input
                  id="gm-free-code"
                  className="gm-dash-input"
                  value={freeformName}
                  onChange={(e) => setFreeformName(e.target.value)}
                  placeholder="e.g. Algorithms and Data Structures"
                  disabled={freeformSaving}
                />
              </div>

              {freeformError ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }} role="alert">
                  {freeformError}
                </p>
              ) : null}

              <div className="gm-dash-add-course-footer">
                <button
                  type="button"
                  className="gm-dash-modal-btn gm-dash-modal-btn--primary"
                  disabled={freeformSaving || !freeformValid}
                  onClick={() => void saveFreeform()}
                >
                  {freeformSaving ? "Saving…" : "Save course"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
