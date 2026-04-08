import { createClient } from "@/lib/supabase/server";
import { getSiteBaseUrl } from "@/lib/siteBaseUrl";
import { DashboardGradeSummaryLive } from "@/components/DashboardGradeSummaryLive";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardSemesterTitleRow } from "@/components/DashboardSemesterTitleRow";
import { DashboardSemesterColumnHeader } from "@/components/DashboardSemesterColumnHeader";
import { DashboardOverallCourseRow } from "@/components/DashboardOverallCourseRow";
import { DashboardCourseTabs } from "@/components/DashboardCourseTabs";
import type { SemesterType } from "@/lib/semester";
import { uqSemesterIsoRange } from "@/lib/uqSemesterCalendar";
import {
  computeCourseSummary,
  computeSemesterCurrentAndOverall,
} from "@/lib/calculations/gpa";

export const dynamic = "force-dynamic";

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
  semester_id?: string;
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
  "semester_id, id, course_code, course_name, credit_points, target_grade, profile_url, university, hurdle_information, created_at, assessment_results(id, assessment_name, weighting, mark, due_date, sub_assessments, is_hurdle, hurdle_threshold, hurdle_requirements)";
const SELECT_ENROLMENTS_NO_SUB =
  "semester_id, id, course_code, course_name, credit_points, target_grade, profile_url, university, hurdle_information, created_at, assessment_results(id, assessment_name, weighting, mark, due_date, is_hurdle, hurdle_threshold, hurdle_requirements)";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const plan: "free" | "pro" = userRow?.plan === "pro" ? "pro" : "free";
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

  const resolvedSearchParams = await Promise.resolve(searchParams);

  const viewParam = resolvedSearchParams?.view;
  const view =
    (Array.isArray(viewParam) ? viewParam[0] : viewParam) === "overall"
      ? "overall"
      : "semester";

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

  let enrolments: DbEnrolment[] = [];
  const withSub = await supabase
    .from("subject_enrolments")
    .select(SELECT_ENROLMENTS_WITH_SUB)
    .in("semester_id", view === "overall" ? semesterIds : [semester.id])
    .order("created_at", { ascending: true })
    .returns<DbEnrolment[]>();

  if (withSub.error) {
    const noSub = await supabase
      .from("subject_enrolments")
      .select(SELECT_ENROLMENTS_NO_SUB)
      .in("semester_id", view === "overall" ? semesterIds : [semester.id])
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

  const enrolmentsBySemesterId = new Map<string, DbEnrolment[]>();
  for (const e of enrolments ?? []) {
    const sid = e.semester_id;
    if (!sid) continue;
    const existing = enrolmentsBySemesterId.get(sid);
    if (existing) existing.push(e);
    else enrolmentsBySemesterId.set(sid, [e]);
  }

  return (
    <main className="gm-container gm-dash-page" style={{ paddingTop: 20 }}>
      <DashboardHeader activeView={view} calendarSubscribe={calendarSubscribe} />

      {view === "overall" ? (
        <div className="gm-dash-overall-board" style={{ marginTop: 6 }}>
          {semesters.map((s, idx) => {
            const sEnrol = enrolmentsBySemesterId.get(s.id) ?? [];
            const semSummary = computeSemesterCurrentAndOverall(
              sEnrol.map((e) =>
                (e.assessment_results ?? []).map((a) => ({
                  weighting: a.weighting,
                  mark: a.mark,
                  due_date: a.due_date,
                })),
              ),
            );
            const summaryLabels = semSummary
              ? {
                  currentLabel:
                    semSummary.current != null
                      ? `${semSummary.current.avg.toFixed(1)}%`
                      : "—",
                  overallLabel: `${semSummary.overall.avg.toFixed(1)}%`,
                }
              : null;
            return (
              <section
                key={s.id}
                className="gm-dash-overall-col"
                style={{ marginLeft: idx === 0 ? 0 : undefined }}
              >
                <div className="gm-dash-overall-col-inner">
                  <DashboardSemesterColumnHeader
                    title={`Semester ${s.semester}, ${s.year}`}
                    summary={summaryLabels}
                    showAddCourseButton={false}
                    addCourse={{
                      semesterId: s.id,
                      year: s.year,
                      semesterLabel: semesterIntToLabel(s.semester),
                      existingCourseCount: sEnrol.length,
                    }}
                  />
                  <div className="gm-dash-overall-course-list">
                    {sEnrol.map((e) => {
                      const courseSummary = computeCourseSummary({
                        credit_points: e.credit_points,
                        target_grade: e.target_grade,
                        assessments: (e.assessment_results ?? []).map((a) => ({
                          weighting: a.weighting,
                          mark: a.mark,
                          due_date: a.due_date,
                        })),
                      });
                      return (
                        <DashboardOverallCourseRow
                          key={e.id}
                          courseCode={e.course_code}
                          courseName={e.course_name}
                          currentAvgPercent={courseSummary.completedAveragePercent}
                          overallPercentSoFar={courseSummary.overallPercentSoFar}
                          targetGrade={e.target_grade}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <DashboardSemesterTitleRow
            title={`Semester ${semester.semester}, ${semester.year}`}
            addCourse={{
              semesterId: semester.id,
              year: semester.year,
              semesterLabel: semesterIntToLabel(semester.semester),
              existingCourseCount: (enrolmentsBySemesterId.get(semester.id) ?? [])
                .length,
            }}
          />

          <DashboardGradeSummaryLive
            semesterStart={semesterStart}
            semesterEnd={semesterEnd}
            enrolments={(enrolmentsBySemesterId.get(semester.id) ?? []).map(
              (e) => ({
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
              }),
            )}
          />

          <div style={{ marginTop: 8 }}>
            <DashboardCourseTabs
              enrolments={(enrolmentsBySemesterId.get(semester.id) ?? []).map(
                (e) => ({
                  id: e.id,
                  course_code: e.course_code,
                  course_name: e.course_name,
                  credit_points: e.credit_points,
                  target_grade: e.target_grade,
                  profile_url: e.profile_url,
                  university: e.university,
                  hurdle_information: e.hurdle_information,
                  assessment_results: (e.assessment_results ?? []).map((a) => ({
                    id: a.id,
                    assessment_name: a.assessment_name,
                    weighting: a.weighting,
                    mark: a.mark,
                    due_date: a.due_date,
                    sub_assessments: a.sub_assessments,
                  })),
                }),
              )}
            />
          </div>
        </>
      )}
    </main>
  );
}
