export type GradeBand = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// UQ typical grade cut-offs as percentages
export const GRADE_THRESHOLDS: Record<GradeBand, number> = {
  1: 0,
  2: 25,
  3: 45,
  4: 50,
  5: 65,
  6: 75,
  7: 85,
};

/** Percentages where the displayed grade steps up (bands 2–7); use for progress-bar tick marks. */
export const GRADE_BOUNDARY_PERCENTS: readonly number[] = (
  [2, 3, 4, 5, 6, 7] as const
).map((g) => GRADE_THRESHOLDS[g]);

export type WeightedMark = {
  weight: number | "pass/fail"; // percentage of course (e.g. 20 means 20%) or "pass/fail"
  mark?: string | number | null; // Can be fraction string like "9/10", percentage number, or null
};

type WeightedSubMark = {
  mark: string | null | undefined;
  weight: number;
};

function normalizeBestOf(totalRows: number, bestOf?: number | null): number {
  if (bestOf == null || !Number.isFinite(bestOf)) return totalRows;
  return Math.max(1, Math.min(totalRows, Math.floor(bestOf)));
}

function subMarkPercent(row: WeightedSubMark): number | null {
  const str = row.mark == null ? "" : String(row.mark).trim();
  if (str === "") return null;
  const p = parseMarkToPercentage(row.mark);
  return p == null || Number.isNaN(p) ? null : p;
}

function weightedAverageForRows(
  rows: Array<WeightedSubMark & { pct: number }>,
): number | null {
  if (rows.length === 0) return null;
  const wSum = rows.reduce(
    (s, r) => s + (typeof r.weight === "number" && r.weight > 0 ? r.weight : 0),
    0,
  );
  if (wSum > 0) {
    return rows.reduce((acc, r) => acc + (r.pct * r.weight) / wSum, 0);
  }
  return rows.reduce((acc, r) => acc + r.pct, 0) / rows.length;
}

function selectBestMarkedRows(
  rows: WeightedSubMark[],
  bestOf?: number | null,
): Array<WeightedSubMark & { pct: number }> {
  const marked = rows
    .map((r) => {
      const pct = subMarkPercent(r);
      return pct == null ? null : { ...r, pct };
    })
    .filter(Boolean) as Array<WeightedSubMark & { pct: number }>;
  const count = Math.min(normalizeBestOf(rows.length, bestOf), marked.length);
  return [...marked].sort((a, b) => b.pct - a.pct).slice(0, count);
}

/**
 * Compute weighted total (0–100) from assessment items. Pass/fail items are excluded.
 */
export function calculateWeightedTotal(items: WeightedMark[]): number {
  return items.reduce((sum, item) => {
    // Skip pass/fail items in weighted calculation
    if (item.weight === "pass/fail") return sum;
    const percentage = parseMarkToPercentage(item.mark);
    if (percentage == null || Number.isNaN(percentage)) return sum;
    return sum + (percentage * (typeof item.weight === "number" ? item.weight : 0)) / 100;
  }, 0);
}

export function calculateRequiredMarkForTarget(
  items: WeightedMark[],
  targetPercent: number,
  remainingWeightIndex: number,
): number | null {
  if (
    remainingWeightIndex < 0 ||
    remainingWeightIndex >= items.length ||
    items[remainingWeightIndex].mark != null
  ) {
    return null;
  }

  const remainingItem = items[remainingWeightIndex];
  
  // Can't calculate required mark for pass/fail items
  if (remainingItem.weight === "pass/fail") {
    return null;
  }

  const currentTotal = calculateWeightedTotal(items);
  const remainingWeight = remainingItem.weight;

  if (typeof remainingWeight !== "number") {
    return null;
  }

  const neededRaw =
    ((targetPercent - currentTotal) * 100) / Math.max(remainingWeight, 0.0001);

  return Math.min(100, Math.max(0, neededRaw));
}

export function percentToGradeBand(percent: number): GradeBand {
  let best: GradeBand = 1;
  (Object.keys(GRADE_THRESHOLDS) as unknown as GradeBand[]).forEach((g) => {
    if (percent >= GRADE_THRESHOLDS[g] && g > best) {
      best = g;
    }
  });
  return best;
}

/**
 * Parse a mark input to a percentage (0–100).
 * Accepts: "9/10" → 90, "16/20" → 80, "85" → 85, "85.5" → 85.5. Returns null if invalid.
 */
export function parseMarkToPercentage(mark: string | number | null | undefined): number | null {
  if (mark == null) return null;
  if (typeof mark === "number") return mark;
  
  const str = String(mark).trim();
  if (str === "") return null;
  
  // Check for fraction format (e.g., "9/10", "16/20")
  const fractionMatch = str.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    if (denominator === 0) return null;
    return (numerator / denominator) * 100;
  }
  
  // Otherwise, treat as percentage
  const num = parseFloat(str);
  return Number.isNaN(num) ? null : num;
}

/**
 * Format a mark for display, showing both fraction and percentage if applicable
 */
export function formatMarkDisplay(mark: string | number | null | undefined): { display: string; percentage: number | null } {
  if (mark == null) return { display: "", percentage: null };
  
  const str = String(mark).trim();
  if (str === "") return { display: "", percentage: null };
  
  // Check if it's already a fraction format
  const fractionMatch = str.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    const percentage = denominator === 0 ? null : (numerator / denominator) * 100;
    return { display: str, percentage };
  }
  
  // Otherwise, it's a percentage
  const num = parseFloat(str);
  if (Number.isNaN(num)) return { display: str, percentage: null };
  return { display: String(num), percentage: num };
}

/**
 * Calculate equal-distribution marks for all uncompleted assessments to achieve target grade.
 * Returns an array with suggested marks (as percentages) for each assessment, or null if:
 * - Assessment is already completed
 * - Assessment is pass/fail
 * - Target is impossible to achieve
 * - Target is already exceeded
 */
/**
 * Weighted overall % for this assessment. Returns null unless **every** row has a valid mark.
 */
export function aggregateSubAssessmentMarks(
  rows: WeightedSubMark[],
  bestOf?: number | null,
): { mode: "percent"; value: number } | null {
  if (rows.length === 0) return null;
  const needed = normalizeBestOf(rows.length, bestOf);
  const selected = selectBestMarkedRows(rows, bestOf);
  if (selected.length < needed) return null;
  const value = weightedAverageForRows(selected);
  return value == null ? null : { mode: "percent", value };
}

export function currentSubAssessmentPercent(
  rows: WeightedSubMark[],
  bestOf?: number | null,
): number | null {
  if (rows.length === 0) return null;
  const selected = selectBestMarkedRows(rows, bestOf);
  return weightedAverageForRows(selected);
}

/**
 * Best-case weighted % on this assessment if every part without a valid mark scores 100%.
 * Same weighting as aggregateSubAssessmentMarks (weights are course % shares of this item).
 */
export function maxAchievableSubAssessmentPercent(
  rows: WeightedSubMark[],
  bestOf?: number | null,
): number | null {
  if (rows.length === 0) return null;
  const count = normalizeBestOf(rows.length, bestOf);
  const candidates = rows.map((r) => ({
    ...r,
    pct: subMarkPercent(r) ?? 100,
  }));
  const selected = [...candidates].sort((a, b) => b.pct - a.pct).slice(0, count);
  return weightedAverageForRows(selected);
}

export function formatAggregateMarkForStorage(
  agg: ReturnType<typeof aggregateSubAssessmentMarks>,
): string | null {
  if (agg == null) return null;
  const v = agg.value;
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(Math.round(v)) : rounded.toFixed(1);
}

export function calculateEqualDistributionMarks(
  items: WeightedMark[],
  targetPercent: number,
): Array<number | null> {
  const currentTotal = calculateWeightedTotal(items);
  const needed = targetPercent - currentTotal;
  
  // If target already exceeded or exactly met, return all nulls
  if (needed <= 0) {
    return items.map(() => null);
  }
  
  // Find all uncompleted assessments (excluding pass/fail)
  const uncompletedIndices: number[] = [];
  let totalRemainingWeight = 0;
  
  items.forEach((item, index) => {
    // Skip pass/fail items
    if (item.weight === "pass/fail") return;
    
    // Skip completed items
    const percentage = parseMarkToPercentage(item.mark);
    if (percentage != null && !Number.isNaN(percentage)) return;
    
    // This is an uncompleted assessment
    if (typeof item.weight === "number") {
      uncompletedIndices.push(index);
      totalRemainingWeight += item.weight;
    }
  });
  
  // If no remaining assessments, return all nulls
  if (uncompletedIndices.length === 0 || totalRemainingWeight === 0) {
    return items.map(() => null);
  }
  
  // Calculate equal mark needed: (needed percentage points) / (total remaining weight) * 100
  const equalMarkPercent = (needed / totalRemainingWeight) * 100;
  
  // If mark > 100%, target is impossible
  if (equalMarkPercent > 100) {
    return items.map(() => null);
  }
  
  // If mark < 0%, target already exceeded (shouldn't happen due to earlier check, but safety)
  if (equalMarkPercent < 0) {
    return items.map(() => null);
  }
  
  // Return array with suggested marks for uncompleted items, null for others
  return items.map((item, index) => {
    // Pass/fail items get null
    if (item.weight === "pass/fail") return null;
    
    // Completed items get null
    const percentage = parseMarkToPercentage(item.mark);
    if (percentage != null && !Number.isNaN(percentage)) return null;
    
    // Uncompleted items get the equal distribution mark
    return uncompletedIndices.includes(index) ? equalMarkPercent : null;
  });
}

