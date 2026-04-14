import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DbSemester = {
  id: string;
  year: number;
  semester: number;
  name: string | null;
  created_at: string;
};

type DbAssessment = {
  id: string;
  assessment_name: string;
  weighting: number;
  mark: string | null;
  due_date: string | null;
};

type DbEnrolment = {
  semester_id: string | null;
  id: string;
  course_code: string;
  course_name: string;
  credit_points: number;
  target_grade: number | null;
  university: string | null;
  created_at: string;
  assessment_results: DbAssessment[];
};

function csvEscape(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const semRes = await supabase
    .from("semesters")
    .select("id, year, semester, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<DbSemester[]>();

  const semesters = semRes.data ?? [];
  const semesterIds = semesters.map((s) => s.id);

  const enrolRes =
    semesterIds.length > 0
      ? await supabase
          .from("subject_enrolments")
          .select(
            "semester_id, id, course_code, course_name, credit_points, target_grade, university, created_at, assessment_results(id, assessment_name, weighting, mark, due_date)",
          )
          .in("semester_id", semesterIds)
          .order("created_at", { ascending: true })
          .returns<DbEnrolment[]>()
      : { data: [] as DbEnrolment[] };

  const enrolments = enrolRes.data ?? [];
  const semesterById = new Map(semesters.map((s) => [s.id, s]));

  const lines: string[] = [];
  lines.push(
    [
      "semester_name",
      "semester_year",
      "semester_number",
      "course_code",
      "course_name",
      "course_university",
      "assessment_name",
      "assessment_weighting",
      "assessment_mark",
      "assessment_due_date",
    ].join(","),
  );

  for (const e of enrolments) {
    const s = e.semester_id ? semesterById.get(e.semester_id) : null;
    const semName = s?.name ?? "";
    const semYear = s?.year ?? "";
    const semNum = s?.semester ?? "";
    const uni = e.university ?? "";
    const assessments = e.assessment_results ?? [];
    if (!assessments.length) {
      lines.push(
        [
          csvEscape(semName),
          csvEscape(semYear),
          csvEscape(semNum),
          csvEscape(e.course_code),
          csvEscape(e.course_name),
          csvEscape(uni),
          "",
          "",
          "",
          "",
        ].join(","),
      );
      continue;
    }
    for (const a of assessments) {
      lines.push(
        [
          csvEscape(semName),
          csvEscape(semYear),
          csvEscape(semNum),
          csvEscape(e.course_code),
          csvEscape(e.course_name),
          csvEscape(uni),
          csvEscape(a.assessment_name),
          csvEscape(a.weighting),
          csvEscape(a.mark ?? ""),
          csvEscape(a.due_date ?? ""),
        ].join(","),
      );
    }
  }

  const csv = lines.join("\r\n");
  const filename = `grademate-grades-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

