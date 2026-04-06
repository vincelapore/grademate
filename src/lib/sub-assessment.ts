import type { SubAssessmentRow } from "@/lib/state";

type RowInput = {
  name: string;
  mark: string | null;
  weight?: number;
};

/** Split integer `total` across `n` parts that sum exactly to `total`. */
function splitIntegerTotal(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (total <= 0) return Array(parts).fill(0);
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Even split of the assessment's course weight (e.g. 40 → [20,20] for n=2).
 */
export function equalSplitAssessmentWeight(
  assessmentCourseWeight: number,
  n: number
): number[] {
  const total = Math.max(0, Math.round(assessmentCourseWeight));
  if (n <= 0) return [];
  if (n === 1) return [total];
  return splitIntegerTotal(total, n);
}

/**
 * Set one row's weight (course %); remainder is split across other rows as integers.
 */
export function setWeightAt(
  rows: SubAssessmentRow[],
  idx: number,
  rawWeight: number,
  assessmentCourseWeight: number
): SubAssessmentRow[] {
  const total = Math.max(0, Math.round(assessmentCourseWeight));
  const n = rows.length;
  const otherCount = n - 1;
  if (otherCount <= 0) {
    return rows.map((r, i) =>
      i === idx ? { ...r, weight: total } : r
    );
  }
  let W = Math.round(rawWeight);
  W = Math.min(total, Math.max(0, W));
  const rem = total - W;
  const parts = splitIntegerTotal(rem, otherCount);
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
  const total = Math.max(0, Math.round(assessmentCourseWeight));
  if (rows.length === 0) {
    return [{ name: "Part 1", mark: null, weight: total }];
  }
  const hasAll = rows.every(
    (r) => typeof r.weight === "number" && !Number.isNaN(r.weight)
  );
  const sum = hasAll ? rows.reduce((s, r) => s + r.weight!, 0) : 0;

  // Already matches this assessment's course weight
  if (hasAll && sum > 0 && Math.abs(sum - total) < 0.5) {
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
      weight: Math.round((r.weight! * total) / sum)
    }));
    let s = scaled.reduce((a, r) => a + r.weight, 0);
    if (s !== total && scaled.length > 0) {
      const last = scaled.length - 1;
      scaled[last] = {
        ...scaled[last]!,
        weight: scaled[last]!.weight + (total - s)
      };
    }
    return scaled;
  }

  // Legacy: internal shares summing to ~100 → scale to course weight
  if (hasAll && sum > 0 && Math.abs(sum - 100) < 0.5) {
    const scaled = rows.map((r) => ({
      name: r.name,
      mark: r.mark,
      weight: Math.round((r.weight! * total) / sum)
    }));
    let s = scaled.reduce((a, r) => a + r.weight, 0);
    if (s !== total && scaled.length > 0) {
      const last = scaled.length - 1;
      scaled[last] = {
        ...scaled[last]!,
        weight: scaled[last]!.weight + (total - s)
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
