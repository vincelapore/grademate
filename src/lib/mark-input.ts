/**
 * Validation for assessment mark fields (matches landing screen behaviour).
 * Allows empty, "/50" while typing, partial fractions, and percentages 0–100.
 */
export function isValidMarkInput(markValue: string | null): boolean {
  if (markValue == null || markValue.trim() === "") return true;
  const trimmed = markValue.trim();
  if (trimmed.match(/^\/\d*$/)) return true;
  if (
    trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d*(?:\.\d+)?)$/)
  ) {
    return true;
  }
  const num = parseFloat(trimmed);
  return !Number.isNaN(num) && num >= 0 && num <= 100;
}
