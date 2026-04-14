"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { SemesterType } from "@/lib/semester";
import { AddCourseModal } from "@/components/AddCourseModal";
import { CourseLimitModal } from "@/components/CourseLimitModal";

export function DashboardSemesterTitleRow({
  title,
  plan,
  addCourse,
}: {
  title: string;
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
  const atFreeLimit = plan === "free" && addCourse.existingCourseCount >= 4;
  const canAddCourse = plan === "pro" || addCourse.existingCourseCount < 4;

  return (
    <>
      <div className="gm-dash-title-row">
        <h1 className="gm-dash-page-title">{title}</h1>
        {canAddCourse ? (
          <button
            type="button"
            className="gm-dash-btn"
            aria-label="Add course"
            onClick={() => {
              setShowAddCourse(true);
              router.prefetch("/dashboard");
            }}
          >
            <Plus className="h-5 w-5" strokeWidth={1.75} />
            <span>Add course</span>
          </button>
        ) : atFreeLimit ? (
          <button
            type="button"
            className="gm-dash-btn"
            onClick={() => setShowCourseLimit(true)}
          >
            Upgrade for more courses
          </button>
        ) : null}
      </div>

      {canAddCourse && showAddCourse ? (
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

