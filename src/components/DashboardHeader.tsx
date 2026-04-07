"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardSignOutButton } from "@/components/DashboardSignOutButton";
import { GmLogo } from "@/components/gm/GmLogo";
import { UpgradeModal } from "@/components/UpgradeModal";
import type { SemesterType } from "@/lib/semester";
import { AddCourseModal } from "@/components/AddCourseModal";

export function DashboardHeader({
  addCourse,
  proGate,
}: {
  addCourse?: {
    semesterId: string;
    year: number;
    semesterLabel: SemesterType;
    existingCourseCount: number;
  };
  proGate?: {
    plan: "free" | "pro";
    semesterCount: number;
  };
}) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const router = useRouter();

  return (
    <>
      <header className="gm-dash-header-bar">
        <div className="gm-dash-header-left">
          <GmLogo href="/dashboard" />
          {addCourse ? (
            <button
              type="button"
              className="gm-dash-btn"
              onClick={() => {
                setShowAddCourse(true);
                router.prefetch("/dashboard");
              }}
            >
              Add course
            </button>
          ) : null}
          <button
            type="button"
            className="gm-dash-btn"
            onClick={() => {
              if (proGate?.plan !== "pro" && (proGate?.semesterCount ?? 1) >= 1) {
                setShowUpgrade(true);
                return;
              }
              setShowUpgrade(true);
            }}
          >
            Add semester
          </button>
        </div>

        <div className="gm-dash-header-right">
          <Link href="/dashboard/settings" className="gm-dash-btn">
            Settings
          </Link>
          <DashboardSignOutButton className="gm-dash-btn" />
        </div>
      </header>

      {showUpgrade ? (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      ) : null}

      {showAddCourse && addCourse ? (
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
