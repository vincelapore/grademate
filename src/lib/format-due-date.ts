/**
 * Fixed labels so server (Node) and client (browser) render the same string — avoids
 * hydration mismatches from differing ICU data for Intl month/weekday "short".
 */
const WEEKDAYS_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatCalendarDateLocal(y: number, monthIndex: number, d: number): string {
  const local = new Date(y, monthIndex, d);
  if (
    local.getFullYear() !== y ||
    local.getMonth() !== monthIndex ||
    local.getDate() !== d
  ) {
    return `${y}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const wd = WEEKDAYS_SHORT[local.getDay()];
  const mon = MONTHS_SHORT[monthIndex];
  return `${wd}, ${d} ${mon} ${y}`;
}

/**
 * Format a stored due date (usually YYYY-MM-DD) for display without UTC day-shift.
 */
export function formatDueDateForDisplay(
  value: string | null | undefined,
): string {
  if (value == null || String(value).trim() === "") return "—";
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1]!, 10);
    const monthIndex = parseInt(m[2]!, 10) - 1;
    const d = parseInt(m[3]!, 10);
    if (
      Number.isFinite(y) &&
      monthIndex >= 0 &&
      monthIndex <= 11 &&
      d >= 1 &&
      d <= 31
    ) {
      return formatCalendarDateLocal(y, monthIndex, d);
    }
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    return formatCalendarDateLocal(
      dt.getFullYear(),
      dt.getMonth(),
      dt.getDate(),
    );
  }
  return s;
}
