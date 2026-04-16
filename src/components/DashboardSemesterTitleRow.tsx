"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings } from "lucide-react";
import type { SemesterType } from "@/lib/semester";
import { AddCourseModal } from "@/components/AddCourseModal";
import { CourseLimitModal } from "@/components/CourseLimitModal";
import { EditSemesterModal } from "@/components/EditSemesterModal";

export function DashboardSemesterTitleRow({
  title,
  plan,
  addCourse,
  semesterSettings,
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
  semesterSettings: {
    semesterId: string;
    year: number;
    period: "Semester 1" | "Semester 2" | "Trimester 1" | "Trimester 2" | "Trimester 3" | "Summer" | "Winter";
    isCurrent: boolean;
  };
}) {
  const router = useRouter();
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showCourseLimit, setShowCourseLimit] = useState(false);
  const [showSemesterSettings, setShowSemesterSettings] = useState(false);
  const atFreeLimit = plan === "free" && addCourse.existingCourseCount >= 3;
  const canAddCourse = plan === "pro" || addCourse.existingCourseCount < 3;

  return (
    <>
      <div className="gm-dash-title-row">
        <h1 className="gm-dash-page-title">{title}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="gm-dash-icon-btn"
            aria-label="Semester settings"
            title="Semester settings"
            onClick={() => setShowSemesterSettings(true)}
          >
            <Settings className="h-5 w-5" strokeWidth={1.75} />
          </button>
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
      {showSemesterSettings ? (
        <EditSemesterModal
          semesterId={semesterSettings.semesterId}
          initialYear={semesterSettings.year}
          initialPeriod={semesterSettings.period}
          initialIsCurrent={semesterSettings.isCurrent}
          onClose={() => setShowSemesterSettings(false)}
          onDeleted={() => {
            window.location.href = "/dashboard";
          }}
        />
      ) : null}
    </>
  );
}

