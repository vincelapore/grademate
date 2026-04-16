/**
 * Validation for assessment mark fields (matches landing screen behaviour).
 * Allows empty, "/50" while typing, partial fractions, and percentages 0–100.
 */
export function isValidMarkInput(markValue: string | null): boolean {
  if (markValue == null || markValue.trim() === "") return true;
  const trimmed = markValue.trim();
  if (trimmed.match(/^\/\d*$/)) return true;
  const frac = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d*(?:\.\d+)?)$/);
  if (frac) {
    const left = parseFloat(frac[1]!);
    const rightRaw = frac[2]!;
    // Allow while the denominator is still being typed.
    if (!rightRaw) return true;
    const right = parseFloat(rightRaw);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= 0) {
      return false;
    }
    const pct = (left / right) * 100;
    // Fully specified fractions must not exceed 100%.
    return pct <= 100;
  }
  const num = parseFloat(trimmed);
  return !Number.isNaN(num) && num >= 0 && num <= 100;
}
