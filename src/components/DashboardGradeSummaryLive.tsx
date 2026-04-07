"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeDegreeProgressPercent,
  computeSemesterCurrentAndOverall,
  computeSemesterGpaFromEnrolments,
  countAssessmentsDueThisWeek,
} from "@/lib/calculations/gpa";
import { DashboardGradeSummary } from "@/components/DashboardGradeSummary";
import HellWeekCalendar, {
  type HellWeekAssessment,
} from "@/components/HellWeekCalendar";
import { StatsRow } from "@/components/StatsRow";

type AssessmentRow = {
  id: string;
  assessment_name: string;
  weighting: number;
  mark: string | null;
  due_date: string | null;
  sub_assessments?: {
    rows: { name: string; mark: string | null; weight?: number }[];
  } | null;
  is_hurdle?: boolean | null;
  hurdle_threshold?: number | null;
  hurdle_requirements?: string | null;
};

type EnrolmentRow = {
  id: string;
  course_code: string;
  course_name: string;
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
  semesterStart,
  semesterEnd,
}: {
  enrolments: EnrolmentRow[];
  semesterStart: string;
  semesterEnd: string;
}) {
  const [local, setLocal] = useState<EnrolmentRow[]>(enrolments);
  const [hellOpen, setHellOpen] = useState(false);

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
        sub_assessments: a.sub_assessments ?? null,
      })),
    );
    return computeSemesterCurrentAndOverall(courseAssessments);
  }, [local]);

  const gpa = useMemo(() => computeSemesterGpaFromEnrolments(local), [local]);

  const dueThisWeek = useMemo(
    () => countAssessmentsDueThisWeek(local),
    [local],
  );

  const degreeProgressPercent = useMemo(
    () => computeDegreeProgressPercent(local),
    [local],
  );

  const hellAssessments: HellWeekAssessment[] = useMemo(() => {
    const out: HellWeekAssessment[] = [];
    for (const e of local) {
      for (const a of e.assessment_results ?? []) {
        if (!a.due_date) continue;
        out.push({
          id: a.id,
          assessment_name: a.assessment_name,
          weighting: a.weighting,
          due_date: a.due_date,
          course_code: e.course_code,
          course_name: e.course_name,
        });
      }
    }
    return out;
  }, [local]);

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
        onViewHellWeeks={() => setHellOpen(true)}
      />
      {hellOpen ? (
        <HellWeekCalendar
          assessments={hellAssessments}
          semesterStart={semesterStart}
          semesterEnd={semesterEnd}
          onClose={() => setHellOpen(false)}
        />
      ) : null}
    </>
  );
}
