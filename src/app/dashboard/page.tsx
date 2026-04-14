import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteBaseUrl } from "@/lib/siteBaseUrl";
import { DashboardGradeSummaryLive } from "@/components/DashboardGradeSummaryLive";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardSemesterTitleRow } from "@/components/DashboardSemesterTitleRow";
import { DashboardSemesterColumnHeader } from "@/components/DashboardSemesterColumnHeader";
import { DashboardOverallCourseRow } from "@/components/DashboardOverallCourseRow";
import { DashboardCourseTabs } from "@/components/DashboardCourseTabs";
import type { SemesterType } from "@/lib/semester";
import { getSemesterDates } from "@/lib/semester";
import { uqSemesterIsoRange } from "@/lib/uqSemesterCalendar";
import {
  computeCourseSummary,
  computeSemesterCurrentAndOverall,
} from "@/lib/calculations/gpa";
import Link from "next/link";
import { AddSemesterButton } from "@/components/AddSemesterButton";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type DbUser = {
  plan: string | null;
  calendar_token: string | null;
};

type DbSemester = {
  id: string;
  year: number;
  semester: number;
  name: string | null;
  context_mode: string | null;
  context_university: string | null;
  context_year: number | null;
  context_semester: number | null;
  created_at: string;
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

function parseIsoLocalDay(iso: string): Date | null {
  const m = String(iso)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayDiff(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((a.getTime() - b.getTime()) / ms);
}

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

  // Note: local dev may not have run the latest migrations yet.
  // If context columns don't exist, fall back to the older select list.
  let semesters: DbSemester[] | null = null;
  const semResNew = await supabase
    .from("semesters")
    .select(
      "id, year, semester, name, context_mode, context_university, context_year, context_semester, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<DbSemester[]>();
  if (semResNew.error) {
    const semResOld = await supabase
      .from("semesters")
      .select("id, year, semester, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<
        Array<Pick<DbSemester, "id" | "year" | "semester" | "name" | "created_at">>
      >();
    semesters =
      semResOld.data?.map((s) => ({
        ...s,
        context_mode: null,
        context_university: null,
        context_year: null,
        context_semester: null,
      })) ?? null;
  } else {
    semesters = semResNew.data ?? null;
  }

  if (!semesters?.length) return null;

  const resolvedSearchParams = await Promise.resolve(searchParams);

  const viewParam = resolvedSearchParams?.view;
  const rawView = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const cookieStore = await cookies();
  const defaultViewCookie = cookieStore.get("gm_default_dashboard_view")?.value;
  const defaultView: "home" | "semester" =
    defaultViewCookie === "semester" ? "semester" : "home";
  const view: "home" | "semester" | "overall" =
    rawView === "overall"
      ? "overall"
      : rawView === "semester"
        ? "semester"
        : defaultView;

  const sidParam = resolvedSearchParams?.sid;
  const selectedSemesterId = Array.isArray(sidParam) ? sidParam[0] : sidParam;

  if (view === "overall" && plan === "free" && semesters.length > 1) {
    redirect("/dashboard");
  }

  const semesterIds = semesters.map((s) => s.id);
  const { data: enrolSemesterRows } = await supabase
    .from("subject_enrolments")
    .select("semester_id")
    .in("semester_id", semesterIds);

  const semesterIdsWithEnrol = new Set(
    (enrolSemesterRows ?? []).map((r) => r.semester_id),
  );
  const semester =
    (selectedSemesterId
      ? semesters.find((s) => s.id === selectedSemesterId)
      : null) ??
    semesters.find((s) => semesterIdsWithEnrol.has(s.id)) ??
    semesters[0]!;

  const ctxYear = semester.context_year ?? semester.year;
  const ctxSemesterInt = semester.context_semester ?? semester.semester;
  const ctxSemesterLabel = semesterIntToLabel(ctxSemesterInt);
  const ctxUni = (semester.context_university ?? "uq").toLowerCase();
  const computedDates =
    getSemesterDates(
      { year: ctxYear, semester: ctxSemesterLabel, delivery: "Internal" },
      ctxUni,
    ) ?? uqSemesterIsoRange(ctxYear, ctxSemesterInt);
  const { start: semesterStart, end: semesterEnd } = computedDates;

  let enrolments: DbEnrolment[] = [];
  const withSub = await supabase
    .from("subject_enrolments")
    .select(SELECT_ENROLMENTS_WITH_SUB)
    .in("semester_id", view === "semester" ? [semester.id] : semesterIds)
    .order("created_at", { ascending: true })
    .returns<DbEnrolment[]>();

  if (withSub.error) {
    const noSub = await supabase
      .from("subject_enrolments")
      .select(SELECT_ENROLMENTS_NO_SUB)
      .in("semester_id", view === "semester" ? [semester.id] : semesterIds)
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
    <main className="gm-container gm-dash-page" style={{ paddingTop: 14 }}>
      <DashboardHeader
        activeView={view}
        calendarSubscribe={calendarSubscribe}
        plan={plan}
        overallLocked={plan === "free" && semesters.length > 1}
      />

      {view === "home" ? (
        <div className="gm-dash-home">
          <h2 className="gm-dash-home-h2">Semesters</h2>
          <section className="gm-dash-home-section">
            <div className="gm-dash-home-sem-list">
              {semesters.map((s) => {
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
                const currentLabel =
                  semSummary?.current != null
                    ? `${semSummary.current.avg.toFixed(1)}%`
                    : "—";
                const overallLabel =
                  semSummary?.overall != null
                    ? `${semSummary.overall.avg.toFixed(1)}%`
                    : "—";

                return (
                  <Link
                    key={s.id}
                    className="gm-dash-card gm-dash-home-sem-card"
                    href={`/dashboard?view=semester&sid=${encodeURIComponent(s.id)}`}
                  >
                    <div className="gm-dash-home-sem-top">
                      <div className="gm-dash-home-sem-title">
                        {s.name?.trim()
                          ? s.name.trim()
                          : `Semester ${s.semester}, ${s.year}`}
                      </div>
                      <div className="gm-dash-home-sem-meta">
                        {sEnrol.length} course{sEnrol.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="gm-dash-home-sem-stats">
                      <div className="gm-dash-home-sem-stat">
                        <span className="gm-dash-home-sem-key">Current</span>
                        <span className="gm-dash-home-sem-val">
                          {currentLabel}
                        </span>
                      </div>
                      <div className="gm-dash-home-sem-stat">
                        <span className="gm-dash-home-sem-key">Overall</span>
                        <span className="gm-dash-home-sem-val">
                          {overallLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div style={{ marginTop: 10 }}>
              <AddSemesterButton className="gm-dash-components-add" plan={plan} />
            </div>
          </section>
        </div>
      ) : view === "overall" ? (
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
                    plan={plan}
                    addCourse={{
                      semesterId: s.id,
                      year: s.context_year ?? s.year,
                      semesterLabel: semesterIntToLabel(
                        s.context_semester ?? s.semester,
                      ),
                      university:
                        (s.context_university ?? "uq") === "qut" ? "qut" : "uq",
                      lockedMode:
                        s.context_mode === "freeform"
                          ? "freeform"
                          : s.context_mode === "scraper"
                            ? "scraper"
                            : null,
                      lockedUniversity:
                        s.context_university === "qut"
                          ? "qut"
                          : s.context_university === "uq"
                            ? "uq"
                            : null,
                      lockedYear: s.context_year ?? null,
                      lockedSemester:
                        s.context_semester != null
                          ? semesterIntToLabel(s.context_semester)
                          : null,
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
                          currentAvgPercent={
                            courseSummary.completedAveragePercent
                          }
                          overallPercentSoFar={
                            courseSummary.overallPercentSoFar
                          }
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
            title={
              semester.name?.trim()
                ? semester.name.trim()
                : `Semester ${semester.semester}, ${semester.year}`
            }
            plan={plan}
            addCourse={{
              semesterId: semester.id,
              year: ctxYear,
              semesterLabel: ctxSemesterLabel,
              university: ctxUni === "qut" ? "qut" : "uq",
              lockedMode:
                semester.context_mode === "freeform"
                  ? "freeform"
                  : semester.context_mode === "scraper"
                    ? "scraper"
                    : null,
              lockedUniversity:
                semester.context_university === "qut"
                  ? "qut"
                  : semester.context_university === "uq"
                    ? "uq"
                    : null,
              lockedYear: semester.context_year ?? null,
              lockedSemester:
                semester.context_semester != null
                  ? semesterIntToLabel(semester.context_semester)
                  : null,
              existingCourseCount: (
                enrolmentsBySemesterId.get(semester.id) ?? []
              ).length,
            }}
          />

          <DashboardGradeSummaryLive
            plan={plan}
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
                    due_date: a.due_date ?? null,
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
