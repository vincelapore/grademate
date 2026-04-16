export type UqGradePoint = 0 | 1 | 3 | 4 | 5 | 6 | 7;

export const UQ_GRADE_THRESHOLDS: Array<{
  min: number;
  max: number;
  gp: UqGradePoint;
}> = [
  // Fail rule is handled separately (<45 => 0)
  { min: 85, max: 100, gp: 7 },
  { min: 75, max: 84.9999, gp: 6 },
  { min: 65, max: 74.9999, gp: 5 },
  { min: 50, max: 64.9999, gp: 4 },
  { min: 45, max: 49.9999, gp: 3 },
  // Below 45 => 0 (override)
];

export function uqPercentToGradePoint(percent: number): UqGradePoint {
  if (!Number.isFinite(percent)) return 0;
  if (percent < 45) return 0;
  for (const t of UQ_GRADE_THRESHOLDS) {
    if (percent >= t.min && percent <= t.max) return t.gp;
  }
  return 0;
}

export function gradePointToTargetPercent(target: number): number {
  // Targets are 1–7, but the dashboard uses "what do I need to hit target grade"
  // based on the minimum percent for that band.
  switch (target) {
    case 7:
      return 85;
    case 6:
      return 75;
    case 5:
      return 65;
    case 4:
      return 50;
    case 3:
      return 45;
    case 1:
      return 0;
    default:
      return 50;
  }
}

