"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeDegreeProgressPercent,
  computeSemesterCurrentAndOverall,
  computeSemesterGpaFromEnrolments,
  countAssessmentsDueThisWeek,
} from "@/lib/calculations/gpa";
import { DashboardGradeSummary } from "@/components/DashboardGradeSummary";
import { StatsRow } from "@/components/StatsRow";

type AssessmentRow = {
  id: string;
  weighting: number;
  mark: string | null;
  due_date: string | null;
};

type EnrolmentRow = {
  id: string;
  credit_points: number;
  target_grade: number | null;
  assessment_results: AssessmentRow[];
};

type MarkEventDetail = {
  enrolmentId: string;
  assessmentId: string;
  mark: string | null;
};

function isMarkEventDetail(x: unknown): x is MarkEventDetail {
  if (typeof x !== "object" || x == null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.enrolmentId === "string" &&
    typeof r.assessmentId === "string" &&
    (typeof r.mark === "string" || r.mark == null)
  );
}

export function DashboardGradeSummaryLive({
  enrolments,
}: {
  enrolments: EnrolmentRow[];
}) {
  const [local, setLocal] = useState<EnrolmentRow[]>(enrolments);

  // If the server re-renders with new data (refresh/navigation), sync baseline.
  useEffect(() => {
    setLocal(enrolments);
  }, [enrolments]);

  useEffect(() => {
    function onMark(e: Event) {
      const ce = e as CustomEvent<unknown>;
      if (!isMarkEventDetail(ce.detail)) return;
      const { enrolmentId, assessmentId, mark } = ce.detail;
      setLocal((prev) =>
        prev.map((en) =>
          en.id !== enrolmentId
            ? en
            : {
                ...en,
                assessment_results: en.assessment_results.map((a) =>
                  a.id === assessmentId ? { ...a, mark } : a,
                ),
              },
        ),
      );
    }
    window.addEventListener("gm:mark-change", onMark);
    return () => window.removeEventListener("gm:mark-change", onMark);
  }, []);

  const summary = useMemo(() => {
    const courseAssessments = local.map((e) =>
      (e.assessment_results ?? []).map((a) => ({
        weighting: a.weighting,
        mark: a.mark,
        due_date: a.due_date,
      })),
    );
    return computeSemesterCurrentAndOverall(courseAssessments);
  }, [local]);

  const gpa = useMemo(
    () => computeSemesterGpaFromEnrolments(local),
    [local],
  );

  const dueThisWeek = useMemo(
    () => countAssessmentsDueThisWeek(local),
    [local],
  );

  const degreeProgressPercent = useMemo(
    () => computeDegreeProgressPercent(local),
    [local],
  );

  return (
    <>
      <DashboardGradeSummary
        current={summary?.current ?? null}
        overall={summary?.overall ?? null}
      />
      <StatsRow
        gpa={gpa}
        dueThisWeek={dueThisWeek}
        degreeProgressPercent={
          Number.isFinite(degreeProgressPercent) ? degreeProgressPercent : 0
        }
      />
    </>
  );
}

