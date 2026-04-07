import type { SemesterType } from "@/lib/semester";
import { getSemesterDates } from "@/lib/semester";
import { uqSemesterIsoRange } from "@/lib/uqSemesterCalendar";

export type SemesterMilestoneDates = {
  census: string;
  swotVacStart: string;
  examStart: string;
  examEnd: string;
  semesterEnd: string;
};

function semesterIntToType(semester: number): SemesterType {
  if (semester === 2) return "Semester 2";
  if (semester === 1) return "Semester 1";
  return "Summer";
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function teachingBounds(
  university: string,
  year: number,
  semester: number,
): { start: string; end: string } | null {
  const uni = university.toLowerCase();
  if (uni === "uq") {
    return uqSemesterIsoRange(year, semester);
  }
  const sel = {
    year,
    semester: semesterIntToType(semester),
    delivery: "Internal" as const,
  };
  return getSemesterDates(sel, "qut");
}

/**
 * Approximate milestone dates derived from each university's teaching-period bounds
 * in Grademate config (census ≈ week 5, swot vac 1 week before exams, ~2-week exam block).
 */
export function getSemesterMilestoneDates(
  university: string,
  year: number,
  semester: number,
): SemesterMilestoneDates | null {
  const bounds = teachingBounds(university, year, semester);
  if (!bounds) return null;
  const { start: semStart, end: semEnd } = bounds;
  const census = addDaysIso(semStart, 35);
  const examEnd = semEnd;
  const examStart = addDaysIso(examEnd, -13);
  const swotVacStart = addDaysIso(examStart, -7);
  return { census, swotVacStart, examStart, examEnd, semesterEnd: semEnd };
}
