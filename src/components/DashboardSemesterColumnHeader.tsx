"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { SemesterType } from "@/lib/semester";
import { AddCourseModal } from "@/components/AddCourseModal";
import { CourseLimitModal } from "@/components/CourseLimitModal";

export function DashboardSemesterColumnHeader({
  title,
  summary,
  showAddCourseButton = true,
  plan,
  addCourse,
}: {
  title: string;
  summary?: { currentLabel: string; overallLabel: string } | null;
  showAddCourseButton?: boolean;
  plan: "free" | "pro";
  addCourse: {
    semesterId: string;
    year: number;
    semesterLabel: SemesterType;
    university?: "uq" | "qut";
    lockedMode?: "freeform" | "scraper" | null;
    lockedUniversity?: "uq" | "qut" | null;
    lockedYear?: number | null;
    lockedSemester?: SemesterType | null;
    existingCourseCount: number;
  };
}) {
  const router = useRouter();
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showCourseLimit, setShowCourseLimit] = useState(false);
  const atFreeLimit = plan === "free" && addCourse.existingCourseCount >= 3;
  const canAddCourse = plan === "pro" || addCourse.existingCourseCount < 3;

  return (
    <>
      <div className="gm-dash-overall-col-head">
        <div className="min-w-0">
          <h2 className="gm-dash-overall-col-title">{title}</h2>
          {summary ? (
            <div className="gm-dash-overall-col-sub">
              <span className="gm-dash-overall-col-sub-item">
                Current <strong>{summary.currentLabel}</strong>
              </span>
              <span className="gm-dash-overall-col-sub-dot" aria-hidden="true">
                ·
              </span>
              <span className="gm-dash-overall-col-sub-item">
                Overall <strong>{summary.overallLabel}</strong>
              </span>
            </div>
          ) : null}
        </div>
        {showAddCourseButton && canAddCourse ? (
          <button
            type="button"
            className="gm-dash-icon-btn"
            aria-label="Add course"
            onClick={() => {
              setShowAddCourse(true);
              router.prefetch("/dashboard");
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={1.9} />
          </button>
        ) : showAddCourseButton && atFreeLimit ? (
          <button
            type="button"
            className="gm-dash-icon-btn"
            aria-label="Upgrade for more courses"
            title="Upgrade for more courses"
            onClick={() => setShowCourseLimit(true)}
          >
            <Plus className="h-4 w-4" strokeWidth={1.9} />
          </button>
        ) : null}
      </div>

      {showAddCourseButton && canAddCourse && showAddCourse ? (
        <AddCourseModal
          plan={plan}
          semesterId={addCourse.semesterId}
          year={addCourse.year}
          semesterLabel={addCourse.semesterLabel}
          university={addCourse.university}
          lockedMode={addCourse.lockedMode}
          lockedUniversity={addCourse.lockedUniversity}
          lockedYear={addCourse.lockedYear}
          lockedSemester={addCourse.lockedSemester}
          existingCourseCount={addCourse.existingCourseCount}
          onClose={() => setShowAddCourse(false)}
        />
      ) : null}
      {showCourseLimit ? (
        <CourseLimitModal onClose={() => setShowCourseLimit(false)} />
      ) : null}
    </>
  );
}

