"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { SemesterType } from "@/lib/semester";
import { AddCourseSearch } from "@/components/AddCourseSearch";
import { CourseLimitModal } from "@/components/CourseLimitModal";

export function AddCourseModal({
  semesterId,
  year,
  semesterLabel,
  existingCourseCount,
  onClose,
}: {
  semesterId: string;
  year: number;
  semesterLabel: SemesterType;
  existingCourseCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [showLimit, setShowLimit] = useState(existingCourseCount >= 4);

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
          <AddCourseSearch
            university="uq"
            semesterId={semesterId}
            year={year}
            semesterLabel={semesterLabel}
            onDone={() => {
              onClose();
              router.refresh();
            }}
            maxCourses={4}
            initialCourseCount={existingCourseCount}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
