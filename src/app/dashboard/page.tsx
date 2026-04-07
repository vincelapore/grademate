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
  sub_assessments: {
    rows: { name: string; mark: string | null; weight?: number }[];
  } | null;
  is_hurdle: boolean | null;
  hurdle_threshold: number | null;
  hurdle_requirements: string | null;
};

type DbEnrolment = {
  id: string;
  course_code: string;
  course_name: string;
  credit_points: number;
  target_grade: number | null;
  profile_url: string | null;
  university: string | null;
  hurdle_information: string | null;
  created_at: string;
  assessment_results: DbAssessment[];
};

const SELECT_ENROLMENTS_WITH_SUB =
  "id, course_code, course_name, credit_points, target_grade, profile_url, university, hurdle_information, created_at, assessment_results(id, assessment_name, weighting, mark, due_date, sub_assessments, is_hurdle, hurdle_threshold, hurdle_requirements)";
const SELECT_ENROLMENTS_NO_SUB =
  "id, course_code, course_name, credit_points, target_grade, profile_url, university, hurdle_information, created_at, assessment_results(id, assessment_name, weighting, mark, due_date, is_hurdle, hurdle_threshold, hurdle_requirements)";

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

  const { data: semesters } = await supabase
    .from("semesters")
    .select("id, year, semester, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!semesters?.length) return null;

  const semesterIds = semesters.map((s) => s.id);
  const { data: enrolSemesterRows } = await supabase
    .from("subject_enrolments")
    .select("semester_id")
    .in("semester_id", semesterIds);

  const semesterIdsWithEnrol = new Set(
    (enrolSemesterRows ?? []).map((r) => r.semester_id),
  );
  const semester =
    semesters.find((s) => semesterIdsWithEnrol.has(s.id)) ?? semesters[0]!;

  const { start: semesterStart, end: semesterEnd } = uqSemesterIsoRange(
    semester.year,
    semester.semester,
  );

  const { count: semesterCount } = await supabase
    .from("semesters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  let enrolments: DbEnrolment[] = [];
  const withSub = await supabase
    .from("subject_enrolments")
    .select(SELECT_ENROLMENTS_WITH_SUB)
    .eq("semester_id", semester.id)
    .order("created_at", { ascending: true })
    .returns<DbEnrolment[]>();

  if (withSub.error) {
    const noSub = await supabase
      .from("subject_enrolments")
      .select(SELECT_ENROLMENTS_NO_SUB)
      .eq("semester_id", semester.id)
      .order("created_at", { ascending: true });
    enrolments = (noSub.data ?? []).map((e) => ({
      ...e,
      assessment_results: (e.assessment_results ?? []).map((a) => ({
        ...a,
        sub_assessments: null,
      })),
    })) as DbEnrolment[];
  } else {
    enrolments = withSub.data ?? [];
  }

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
            sub_assessments: a.sub_assessments,
            is_hurdle: a.is_hurdle,
            hurdle_threshold: a.hurdle_threshold,
            hurdle_requirements: a.hurdle_requirements,
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

