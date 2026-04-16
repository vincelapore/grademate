import type { SubAssessmentRow } from "@/lib/state";

type RowInput = {
  name: string;
  mark: string | null;
  weight?: number;
};

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Split `total` across `n` parts in 0.1 increments that sum exactly to `total`. */
function splitTenthTotal(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (total <= 0) return Array(parts).fill(0);
  const totalTenths = Math.round(total * 10);
  const baseTenths = Math.floor(totalTenths / parts);
  const remainderTenths = totalTenths - baseTenths * parts;
  return Array.from(
    { length: parts },
    (_, i) => (baseTenths + (i < remainderTenths ? 1 : 0)) / 10,
  );
}

/**
 * Even split of the assessment's course weight (e.g. 40 → [20,20] for n=2).
 */
export function equalSplitAssessmentWeight(
  assessmentCourseWeight: number,
  n: number
): number[] {
  const total = Math.max(0, roundToTenth(assessmentCourseWeight));
  if (n <= 0) return [];
  if (n === 1) return [total];
  return splitTenthTotal(total, n);
}

/**
 * Set one row's weight (course %); remainder is split across other rows in 0.1 increments.
 */
export function setWeightAt(
  rows: SubAssessmentRow[],
  idx: number,
  rawWeight: number,
  assessmentCourseWeight: number
): SubAssessmentRow[] {
  const total = Math.max(0, roundToTenth(assessmentCourseWeight));
  const n = rows.length;
  const otherCount = n - 1;
  if (otherCount <= 0) {
    return rows.map((r, i) =>
      i === idx ? { ...r, weight: total } : r
    );
  }
  let W = roundToTenth(rawWeight);
  W = Math.min(total, Math.max(0, W));
  const rem = roundToTenth(total - W);
  const parts = splitTenthTotal(rem, otherCount);
  let pi = 0;
  return rows.map((r, i) => {
    if (i === idx) return { ...r, weight: W };
    return { ...r, weight: parts[pi++]! };
  });
}

/**
 * Normalize legacy rows (weights summing to ~100) to course % using `assessmentCourseWeight`,
 * or assign an even split of `assessmentCourseWeight`.
 */
export function ensureSubAssessmentRows(
  rows: RowInput[],
  assessmentCourseWeight: number
): SubAssessmentRow[] {
  const total = Math.max(0, roundToTenth(assessmentCourseWeight));
  if (rows.length === 0) {
    return [{ name: "Part 1", mark: null, weight: total }];
  }
  const hasAll = rows.every(
    (r) => typeof r.weight === "number" && !Number.isNaN(r.weight)
  );
  const sum = hasAll ? rows.reduce((s, r) => s + r.weight!, 0) : 0;

  // Already matches this assessment's course weight
  if (hasAll && sum > 0 && Math.abs(sum - total) < 0.05) {
    if (Math.abs(sum - total) < 0.01) {
      return rows.map((r) => ({
        name: r.name,
        mark: r.mark,
        weight: r.weight!
      }));
    }
    const scaled = rows.map((r) => ({
      name: r.name,
      mark: r.mark,
      weight: roundToTenth((r.weight! * total) / sum)
    }));
    const s = scaled.reduce((a, r) => a + r.weight, 0);
    if (Math.abs(s - total) >= 0.01 && scaled.length > 0) {
      const last = scaled.length - 1;
      scaled[last] = {
        ...scaled[last]!,
        weight: roundToTenth(scaled[last]!.weight + (total - s))
      };
    }
    return scaled;
  }

  // Legacy: internal shares summing to ~100 → scale to course weight
  if (hasAll && sum > 0 && Math.abs(sum - 100) < 0.05) {
    const scaled = rows.map((r) => ({
      name: r.name,
      mark: r.mark,
      weight: roundToTenth((r.weight! * total) / sum)
    }));
    const s = scaled.reduce((a, r) => a + r.weight, 0);
    if (Math.abs(s - total) >= 0.01 && scaled.length > 0) {
      const last = scaled.length - 1;
      scaled[last] = {
        ...scaled[last]!,
        weight: roundToTenth(scaled[last]!.weight + (total - s))
      };
    }
    return scaled;
  }

  const eq = equalSplitAssessmentWeight(total, rows.length);
  return rows.map((r, i) => ({
    name: r.name,
    mark: r.mark,
    weight: eq[i]!
  }));
}

export function withEqualWeightsFromRows(
  rows: SubAssessmentRow[],
  assessmentCourseWeight: number
): SubAssessmentRow[] {
  const eq = equalSplitAssessmentWeight(
    assessmentCourseWeight,
    rows.length
  );
  return rows.map((r, i) => ({ ...r, weight: eq[i]! }));
}
