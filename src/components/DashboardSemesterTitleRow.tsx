"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { SemesterType } from "@/lib/semester";
import { AddCourseModal } from "@/components/AddCourseModal";

export function DashboardSemesterTitleRow({
  title,
  addCourse,
}: {
  title: string;
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
      <div className="gm-dash-title-row">
        <h1 className="gm-dash-page-title">{title}</h1>
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
      </div>

      {showAddCourse ? (
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

