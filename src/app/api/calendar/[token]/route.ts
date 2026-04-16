import { NextResponse } from "next/server";
import {
  buildGrademateAssessmentCalendarIcs,
  formatWeightingPct,
  type ICalAllDayEvent,
} from "@/lib/grademateIcal";
import { getSemesterMilestoneDates } from "@/lib/universityCalendarMilestones";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type SemesterRow = {
  id: string;
  year: number;
  semester: number;
  created_at: string;
};

type AssessmentRow = {
  id: string;
  assessment_name: string;
  weighting: number;
  due_date: string | null;
};

type EnrolmentRow = {
  semester_id: string;
  course_code: string;
  course_name: string;
  assessment_results: AssessmentRow[] | null;
};

function dtStampUtcCompact(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function firstNameFromAuthMetadata(meta: Record<string, unknown> | undefined): string {
  if (!meta) return "Your";
  const full =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  const part = full.trim().split(/\s+/)[0];
  return part || "Your";
}

function dueDateToIsoDay(due: string | null): string | null {
  if (!due) return null;
  const m = due.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function semesterLabel(sem: SemesterRow): string {
  return `Semester ${sem.semester}, ${sem.year}`;
}

const DASHBOARD_URL = "https://grademate.dev/dashboard";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (err: unknown) {
    const base = "Calendar unavailable";
    const hint =
      process.env.NODE_ENV !== "production"
        ? `\n\nFor local dev, add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase project → Settings → API → service_role secret).`
        : "";
    const detail =
      err instanceof Error && err.message ? `\n\n${err.message}` : "";
    return new NextResponse(`${base}${detail}${hint}`, { status: 503 });
  }

  const { token: rawParam } = await context.params;
  const token = rawParam.replace(/\.ics$/i, "");

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, plan, university, calendar_token")
    .eq("calendar_token", token)
    .maybeSingle<{
      id: string;
      plan: string | null;
      university: string | null;
      calendar_token: string | null;
    }>();

  if (userErr || !userRow?.calendar_token) {
    return new NextResponse("Not found", { status: 404 });
  }

  const plan = userRow.plan === "pro" ? "pro" : "free";
  const university = (userRow.university ?? "uq").toLowerCase();

  const { data: authData } = await supabase.auth.admin.getUserById(userRow.id);
  const firstName = firstNameFromAuthMetadata(
    authData.user?.user_metadata as Record<string, unknown> | undefined,
  );
  const calName = `Grademate — ${firstName}`;

  const { data: semestersRaw, error: semErr } = await supabase
    .from("semesters")
    .select("id, year, semester, created_at")
    .eq("user_id", userRow.id)
    .order("created_at", { ascending: false })
    .returns<SemesterRow[]>();

  if (semErr || !semestersRaw?.length) {
    const icsEmpty = buildGrademateAssessmentCalendarIcs(
      { calName, dtStampUtcCompact: dtStampUtcCompact() },
      [],
    );
    return new NextResponse(icsEmpty, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const semesters = semestersRaw;
  const targetSemesters = plan === "pro" ? semesters : semesters.slice(0, 1);
  const semesterIds = targetSemesters.map((s) => s.id);

  const { data: enrolments, error: enErr } = await supabase
    .from("subject_enrolments")
    .select(
      "semester_id, course_code, course_name, assessment_results(id, assessment_name, weighting, due_date)",
    )
    .in("semester_id", semesterIds)
    .returns<EnrolmentRow[]>();

  if (enErr) {
    return new NextResponse("Could not load calendar", { status: 500 });
  }

  const events: ICalAllDayEvent[] = [];

  for (const e of enrolments ?? []) {
    const courseCode = e.course_code;
    const courseName = e.course_name;
    for (const a of e.assessment_results ?? []) {
      const day = dueDateToIsoDay(a.due_date);
      if (!day) continue;
      const w = formatWeightingPct(Number(a.weighting));
      events.push({
        uid: `grademate-assessment-${a.id}@grademate.dev`,
        dateStart: day,
        dateEndInclusive: day,
        summary: `${courseCode} — ${a.assessment_name} (${w}%)`,
        description: `Weighting: ${w}% | Course: ${courseName}`,
        url: DASHBOARD_URL,
      });
    }
  }

  if (plan === "pro") {
    for (const sem of targetSemesters) {
      const label = semesterLabel(sem);
      const ms = getSemesterMilestoneDates(university, sem.year, sem.semester);
      if (!ms) continue;
      events.push({
        uid: `grademate-milestone-census-${sem.id}@grademate.dev`,
        dateStart: ms.census,
        dateEndInclusive: ms.census,
        summary: "Census date — last day to withdraw",
        description: label,
        url: DASHBOARD_URL,
      });
      events.push({
        uid: `grademate-milestone-swot-${sem.id}@grademate.dev`,
        dateStart: ms.swotVacStart,
        dateEndInclusive: ms.swotVacStart,
        summary: "Swot Vac begins",
        description: label,
        url: DASHBOARD_URL,
      });
      events.push({
        uid: `grademate-milestone-exam-${sem.id}@grademate.dev`,
        dateStart: ms.examStart,
        dateEndInclusive: ms.examEnd,
        summary: `Exam Period — ${label}`,
        description: label,
        url: DASHBOARD_URL,
      });
      events.push({
        uid: `grademate-milestone-end-${sem.id}@grademate.dev`,
        dateStart: ms.semesterEnd,
        dateEndInclusive: ms.semesterEnd,
        summary: `Semester ends — ${label}`,
        description: label,
        url: DASHBOARD_URL,
      });
    }
  }

  events.sort((a, b) => {
    const c = a.dateStart.localeCompare(b.dateStart);
    if (c !== 0) return c;
    return a.uid.localeCompare(b.uid);
  });

  const ics = buildGrademateAssessmentCalendarIcs(
    { calName, dtStampUtcCompact: dtStampUtcCompact() },
    events,
  );

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
