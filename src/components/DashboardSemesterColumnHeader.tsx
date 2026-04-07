"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { SemesterType } from "@/lib/semester";
import { AddCourseModal } from "@/components/AddCourseModal";

export function DashboardSemesterColumnHeader({
  title,
  summary,
  showAddCourseButton = true,
  addCourse,
}: {
  title: string;
  summary?: { currentLabel: string; overallLabel: string } | null;
  showAddCourseButton?: boolean;
  addCourse: {
    semesterId: string;
    year: number;
    semesterLabel: SemesterType;
    existingCourseCount: number;
  };
}) {
  const router = useRouter();
  const [showAddCourse, setShowAddCourse] = useState(false);

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
        {showAddCourseButton ? (
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
        ) : null}
      </div>

      {showAddCourseButton && showAddCourse ? (
        <AddCourseModal
          semesterId={addCourse.semesterId}
          year={addCourse.year}
          semesterLabel={addCourse.semesterLabel}
          existingCourseCount={addCourse.existingCourseCount}
          onClose={() => setShowAddCourse(false)}
        />
      ) : null}
    </>
  );
}

