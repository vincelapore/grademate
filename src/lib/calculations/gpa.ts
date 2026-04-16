import {
  calculateWeightedTotal,
  parseMarkToPercentage,
  percentToGradeBand,
  type GradeBand,
  type WeightedMark,
} from "@/lib/grades";
import { gradePointToTargetPercent, uqPercentToGradePoint } from "./grades";

export type AssessmentRow = {
  weighting: number;
  mark: string | null;
  due_date: string | null;
  sub_assessments?: {
    rows: { name: string; mark: string | null; weight?: number }[];
  } | null;
};

export type SubjectRow = {
  credit_points: number;
  target_grade: number | null;
  assessments: AssessmentRow[];
};

function markToPercent(mark: string | null): number | null {
  const p = parseMarkToPercentage(mark);
  if (p == null || Number.isNaN(p) || !Number.isFinite(p)) return null;
  // Keep in the expected 0–100 range (UI validation should enforce this anyway).
  return Math.min(100, Math.max(0, p));
}

export function computeCourseSummary(subject: SubjectRow): {
  /** Weighted % contribution earned so far (0–100), excluding unmarked items. */
  overallPercentSoFar: number | null;
  /** Average % across completed assessments only (0–100). */
  completedAveragePercent: number | null;
  /** Max possible overall % if remaining assessments score 100%. */
  maxPossibleOverallPercent: number;
  /** Whether the target % is achievable given current marks. */
  isTargetAchievable: boolean;
  completedWeight: number;
  remainingWeight: number;
  weightedPointsCompleted: number;
  requiredOnRemainingToHitTarget: number | null;
  targetPercent: number;
  gradePointIfComplete: number | null;
} {
  let completedWeight = 0;
  let remainingWeight = 0;
  let weightedPointsCompleted = 0;
  let hasEnteredMarks = false;
  let maxPossibleOverallPercent = 0;

  for (const a of subject.assessments) {
    const w = typeof a.weighting === "number" ? a.weighting : 0;
    const percent = markToPercent(a.mark);
    if (percent == null) {
      remainingWeight += w;
      maxPossibleOverallPercent += w; // assume 100% on remaining
      continue;
    }
    hasEnteredMarks = true;
    completedWeight += w;
    weightedPointsCompleted += (percent * w) / 100;
    maxPossibleOverallPercent += (percent * w) / 100;
  }

  const overallPercentSoFar = completedWeight > 0 ? weightedPointsCompleted : null;
  const completedAveragePercent =
    completedWeight > 0 ? (weightedPointsCompleted * 100) / completedWeight : null;

  const targetPercent = gradePointToTargetPercent(subject.target_grade ?? 7);

  const requiredOnRemainingToHitTarget =
    remainingWeight > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((targetPercent - weightedPointsCompleted) * 100) / remainingWeight,
          ),
        )
      : null;

  // If no marks have been entered yet, treat target as achievable (matches /university/uq behavior).
  const isTargetAchievable = !hasEnteredMarks || maxPossibleOverallPercent >= targetPercent;

  const gradePointIfComplete =
    remainingWeight <= 0 && completedAveragePercent != null
      ? uqPercentToGradePoint(completedAveragePercent)
      : null;

  return {
    overallPercentSoFar,
    completedAveragePercent,
    maxPossibleOverallPercent,
    isTargetAchievable,
    completedWeight,
    remainingWeight,
    weightedPointsCompleted,
    requiredOnRemainingToHitTarget,
    targetPercent,
    gradePointIfComplete,
  };
}

export function computeSemesterGpa(
  subjects: Array<{
    credit_points: number;
    final_percent: number | null;
  }>,
): number | null {
  let totalCp = 0;
  let total = 0;
  for (const s of subjects) {
    const cp = s.credit_points ?? 0;
    if (!Number.isFinite(cp) || cp <= 0) continue;
    if (s.final_percent == null) continue;
    totalCp += cp;
    total += uqPercentToGradePoint(s.final_percent) * cp;
  }
  if (totalCp <= 0) return null;
  return total / totalCp;
}

/**
 * Semester-wide averages matching `/university/uq` dashboardSummary:
 * - **overall**: mean per-course weighted total (unmarked assessments contribute 0).
 * - **current**: mean of per-course averages over marked assessments only; null if none.
 */
export function computeSemesterCurrentAndOverall(
  courseAssessments: AssessmentRow[][],
): {
  overall: { avg: number; band: GradeBand };
  current: { avg: number; band: GradeBand } | null;
} | null {
  if (courseAssessments.length === 0) return null;

  const overalls: number[] = [];
  const currents: number[] = [];

  for (const assessments of courseAssessments) {
    const flat: WeightedMark[] = [];
    for (const a of assessments) {
      const rows = a.sub_assessments?.rows;
      const hasParts = (rows?.length ?? 0) > 1;
      if (hasParts) {
        const rawWeights = rows!.map((r) =>
          typeof (r as { weight?: number }).weight === "number" &&
          Number.isFinite((r as { weight?: number }).weight) &&
          (r as { weight?: number }).weight! > 0
            ? (r as { weight?: number }).weight!
            : 0,
        );
        const wSum = rawWeights.reduce((s, w) => s + w, 0);
        const denom = wSum > 0 ? wSum : rows!.length;
        rows!.forEach((r, idx) => {
          const share =
            denom > 0
              ? (wSum > 0 ? rawWeights[idx]! / denom : 1 / denom)
              : 0;
          const markStr =
            r.mark == null ? null : String(r.mark).trim() ? String(r.mark).trim() : null;
          flat.push({ weight: a.weighting * share, mark: markStr });
        });
        continue;
      }
      flat.push({ weight: a.weighting, mark: a.mark ?? null });
    }

    // Overall: exactly matches `/university/uq` semantics — unmarked contribute 0.
    overalls.push(
      calculateWeightedTotal(flat),
    );

    let markedSum = 0;
    let markedWeightSum = 0;
    for (const it of flat) {
      const p = markToPercent(typeof it.mark === "string" ? it.mark : null);
      if (p == null || Number.isNaN(p)) continue;
      const w =
        typeof it.weight === "number" && Number.isFinite(it.weight) ? it.weight : 0;
      markedWeightSum += w;
      markedSum += (p * w) / 100;
    }
    if (markedWeightSum > 0) {
      currents.push((markedSum / markedWeightSum) * 100);
    }
  }

  const overallAvg =
    overalls.reduce((acc, v) => acc + v, 0) / overalls.length;
  const currentAvg =
    currents.length > 0
      ? currents.reduce((acc, v) => acc + v, 0) / currents.length
      : null;

  return {
    overall: {
      avg: overallAvg,
      band: percentToGradeBand(overallAvg),
    },
    current:
      currentAvg != null
        ? {
            avg: currentAvg,
            band: percentToGradeBand(currentAvg),
          }
        : null,
  };
}

function startOfCalendarWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfCalendarWeekMonday(d: Date): Date {
  const x = startOfCalendarWeekMonday(d);
  x.setDate(x.getDate() + 7);
  return x;
}

/** Matches dashboard page: incomplete assessments due Mon–Sun (week starting Monday). */
export function countAssessmentsDueThisWeek(
  enrolments: Array<{
    assessment_results: Array<{
      due_date: string | null;
      mark: string | null;
    }>;
  }>,
  now: Date = new Date(),
): number {
  const wStart = startOfCalendarWeekMonday(now);
  const wEnd = endOfCalendarWeekMonday(now);
  let acc = 0;
  for (const e of enrolments) {
    for (const a of e.assessment_results ?? []) {
      if (!a.due_date) continue;
      if (a.mark != null && String(a.mark).trim() !== "") continue;
      const due = new Date(`${a.due_date}T00:00:00`);
      if (due >= wStart && due < wEnd) acc += 1;
    }
  }
  return acc;
}

export function computeDegreeProgressPercent(
  enrolments: Array<{
    credit_points: number;
    assessment_results: Array<{ mark: string | null }>;
  }>,
  degreeTotalCredits = 32,
): number {
  const creditCompleted = enrolments.reduce((acc, e) => {
    const allMarked = (e.assessment_results ?? []).every(
      (a) => a.mark != null && String(a.mark).trim() !== "",
    );
    return acc + (allMarked ? e.credit_points : 0);
  }, 0);
  if (!Number.isFinite(degreeTotalCredits) || degreeTotalCredits <= 0)
    return 0;
  return Math.round((creditCompleted / degreeTotalCredits) * 100);
}

export function computeSemesterGpaFromEnrolments(
  enrolments: Array<{
    credit_points: number;
    target_grade: number | null;
    assessment_results: Array<{
      weighting: number;
      mark: string | null;
      due_date: string | null;
    }>;
  }>,
): number | null {
  const rows = enrolments.map((e) => {
    const summary = computeCourseSummary({
      credit_points: e.credit_points,
      target_grade: e.target_grade,
      assessments: (e.assessment_results ?? []).map((a) => ({
        weighting: a.weighting,
        mark: a.mark,
        due_date: a.due_date,
      })),
    });
    return {
      credit_points: e.credit_points,
      final_percent:
        summary.remainingWeight <= 0 ? summary.completedAveragePercent : null,
    };
  });
  return computeSemesterGpa(rows);
}

