import { createClient } from "@/lib/supabase/server";
import { getSiteBaseUrl } from "@/lib/siteBaseUrl";
import { DashboardGradeSummaryLive } from "@/components/DashboardGradeSummaryLive";
import { CourseCard } from "@/components/CourseCard";
import { DashboardHeader } from "@/components/DashboardHeader";
import type { SemesterType } from "@/lib/semester";
import { uqSemesterIsoRange } from "@/lib/uqSemesterCalendar";

export const dynamic = "force-dynamic";

type DbSemester = {
  id: string;
  year: number;
  semester: number;
  created_at: string;
};

type DbUser = {
  plan: string | null;
  calendar_token: string | null;
};

function semesterIntToLabel(n: number): SemesterType {
  return n === 2 ? "Semester 2" : "Semester 1";
}

type DbAssessment = {
  id: string;
  assessment_name: string;
  weighting: number;
  mark: string | null;
  due_date: string | null;
};

type DbEnrolment = {
  id: string;
  course_code: string;
  course_name: string;
  credit_points: number;
  target_grade: number | null;
  profile_url: string | null;
  university: string | null;
  created_at: string;
  assessment_results: DbAssessment[];
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("plan, calendar_token")
    .eq("id", user.id)
    .maybeSingle<DbUser>();
  const plan: "free" | "pro" =
    userRow?.plan === "pro" ? "pro" : "free";
  const baseUrl = await getSiteBaseUrl();
  const calendarSubscribe =
    userRow?.calendar_token != null && userRow.calendar_token.length > 0
      ? {
          feedUrl: `${baseUrl}/api/calendar/${userRow.calendar_token}.ics`,
          plan,
        }
      : null;

  const { data: semester } = await supabase
    .from("semesters")
    .select("id, year, semester, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single<DbSemester>();

  if (!semester) return null;

  const { start: semesterStart, end: semesterEnd } = uqSemesterIsoRange(
    semester.year,
    semester.semester,
  );

  const { count: semesterCount } = await supabase
    .from("semesters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: enrolments } = await supabase
    .from("subject_enrolments")
    .select(
      "id, course_code, course_name, credit_points, target_grade, profile_url, university, created_at, assessment_results(id, assessment_name, weighting, mark, due_date)",
    )
    .eq("semester_id", semester.id)
    .order("created_at", { ascending: true })
    .returns<DbEnrolment[]>();

  return (
    <main className="gm-container gm-dash-page" style={{ paddingTop: 20 }}>
      <DashboardHeader
        addCourse={{
          semesterId: semester.id,
          year: semester.year,
          semesterLabel: semesterIntToLabel(semester.semester),
          existingCourseCount: (enrolments ?? []).length,
        }}
        proGate={{
          plan,
          semesterCount: semesterCount ?? 1,
        }}
        calendarSubscribe={calendarSubscribe}
      />

      <h1 className="gm-dash-page-title">
        Semester {semester.semester}, {semester.year}
      </h1>

      <DashboardGradeSummaryLive
        semesterStart={semesterStart}
        semesterEnd={semesterEnd}
        enrolments={(enrolments ?? []).map((e) => ({
          id: e.id,
          course_code: e.course_code,
          course_name: e.course_name,
          credit_points: e.credit_points,
          target_grade: e.target_grade,
          assessment_results: (e.assessment_results ?? []).map((a) => ({
            id: a.id,
            assessment_name: a.assessment_name,
            weighting: a.weighting,
            mark: a.mark,
            due_date: a.due_date,
          })),
        }))}
      />

      <div className="gm-dash-course-list" style={{ marginTop: 8 }}>
        {(enrolments ?? []).map((e) => (
          <CourseCard
            key={e.id}
            enrolment={e}
          />
        ))}
      </div>
    </main>
  );
}

