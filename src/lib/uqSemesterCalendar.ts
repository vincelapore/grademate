/**
 * UQ semester teaching-period bounds (ISO calendar dates, local).
 * Replace with per-university dynamic data when available.
 */
export function uqSemesterIsoRange(
  year: number,
  semester: number,
): { start: string; end: string } {
  if (semester === 1) {
    return { start: `${year}-02-23`, end: `${year}-06-27` };
  }
  if (semester === 2) {
    return { start: `${year}-07-27`, end: `${year}-11-07` };
  }
  return { start: `${year}-02-23`, end: `${year}-06-27` };
}
