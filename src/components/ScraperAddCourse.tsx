"use client";

import { useMemo, useState } from "react";
import type { SemesterType } from "@/lib/semester";
import { AddCourseSearch } from "@/components/AddCourseSearch";

export function ScraperAddCourse({
  semesterId,
  defaultYear,
  defaultSemesterLabel,
  lockedUniversity,
  lockedYear,
  lockedSemester,
  isLocked,
  existingCourseCount,
  maxCourses,
  onBack,
  onDone,
}: {
  semesterId: string;
  defaultYear: number;
  defaultSemesterLabel: SemesterType;
  lockedUniversity?: "uq" | "qut" | null;
  lockedYear?: number | null;
  lockedSemester?: SemesterType | null;
  isLocked: boolean;
  existingCourseCount: number;
  maxCourses: number;
  onBack?: () => void;
  onDone: () => void;
}) {
  const nowYear = new Date().getFullYear();
  const [uiContextLocked, setUiContextLocked] = useState(false);

  const [university, setUniversity] = useState<"uq" | "qut">(() => {
    if (lockedUniversity === "uq" || lockedUniversity === "qut") return lockedUniversity;
    if (typeof window === "undefined") return "uq";
    try {
      const u = window.localStorage.getItem("gm_default_university");
      return u === "qut" ? "qut" : "uq";
    } catch {
      return "uq";
    }
  });
  const [year, setYear] = useState<number>(lockedYear ?? defaultYear);
  const [semesterLabel, setSemesterLabel] = useState<SemesterType>(
    lockedSemester ?? defaultSemesterLabel,
  );

  const showPickers = !isLocked && !uiContextLocked;

  const lockedText = useMemo(() => {
    const y = lockedYear ?? year;
    const s = lockedSemester ?? semesterLabel;
    const uniLabel = (lockedUniversity ?? university).toUpperCase();
    return `${uniLabel} · ${s} ${y}`;
  }, [lockedSemester, lockedUniversity, lockedYear, semesterLabel, university, year]);

  return (
    <>
      {!isLocked && onBack ? (
        <button
          type="button"
          className="gm-dash-add-course-btn-back"
          onClick={onBack}
        >
          ← Back
        </button>
      ) : null}

      {showPickers ? (
        <div className="gm-dash-add-course-context-card">
          <div className="gm-dash-add-course-context-grid">
            <div className="gm-dash-add-course-context-field">
              <label className="gm-dash-field-label" htmlFor="gm-scrape-uni">
                University
              </label>
              <select
                id="gm-scrape-uni"
                className="gm-dash-select"
                value={lockedUniversity ?? university}
                disabled={Boolean(lockedUniversity)}
                onChange={(e) => setUniversity(e.target.value === "qut" ? "qut" : "uq")}
              >
                <option value="uq">UQ</option>
                <option value="qut" disabled>
                  QUT (coming soon)
                </option>
              </select>
            </div>

            <div className="gm-dash-add-course-context-field">
              <label className="gm-dash-field-label" htmlFor="gm-scrape-year">
                Year
              </label>
              <select
                id="gm-scrape-year"
                className="gm-dash-select"
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: 9 }).map((_, idx) => {
                  const y = nowYear - 6 + idx;
                  return (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="gm-dash-add-course-context-field">
              <label className="gm-dash-field-label" htmlFor="gm-scrape-sem">
                Semester
              </label>
              <select
                id="gm-scrape-sem"
                className="gm-dash-select"
                value={semesterLabel}
                onChange={(e) =>
                  setSemesterLabel(
                    e.target.value === "Semester 2"
                      ? "Semester 2"
                      : "Semester 1",
                  )
                }
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginBottom: 12,
            fontSize: 13,
            color: "var(--color-text-tertiary)",
          }}
        >
          {lockedText}
        </div>
      )}

      <AddCourseSearch
        university={lockedUniversity ?? university}
        semesterId={semesterId}
        year={lockedYear ?? year}
        semesterLabel={lockedSemester ?? semesterLabel}
        onContextLocked={() => setUiContextLocked(true)}
        onDone={onDone}
        maxCourses={maxCourses}
        initialCourseCount={existingCourseCount}
      />
    </>
  );
}
