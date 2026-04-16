import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeProfileUrlForStorage,
  normalizeUniversityCode,
} from "@/lib/profile-url";

function profileUrlForDb(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return normalizeProfileUrlForStorage(raw);
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

const FREE_MAX_COURSES_PER_SEMESTER = 3;

type CoursePayload = {
  courseCode: string;
  courseName: string;
  creditPoints: number;
  targetGrade: number;
  profileUrl?: string | null;
  university?: string | null;
  hurdleInformation?: string | null;
  assessments: Array<{
    assessmentName: string;
    weighting: number;
    dueDate: string | null;
    isHurdle?: boolean;
    hurdleThreshold?: number | null;
    hurdleRequirements?: string | null;
  }>;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  let user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("bearer ".length).trim()
      : "";
    if (token) {
      user = (await supabase.auth.getUser(token)).data.user;
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bodyUnknown: unknown = await request.json().catch(() => null);
  const semesterId =
    typeof bodyUnknown === "object" && bodyUnknown != null && "semesterId" in bodyUnknown
      ? String((bodyUnknown as { semesterId: unknown }).semesterId)
      : "";
  const courses =
    typeof bodyUnknown === "object" && bodyUnknown != null && "courses" in bodyUnknown
      ? ((bodyUnknown as { courses: unknown }).courses as unknown)
      : null;
  const context =
    typeof bodyUnknown === "object" && bodyUnknown != null && "context" in bodyUnknown
      ? ((bodyUnknown as { context: unknown }).context as unknown)
      : null;
  const contextYear =
    typeof context === "object" && context != null && "year" in context
      ? Number((context as { year: unknown }).year)
      : null;
  const contextSemester =
    typeof context === "object" && context != null && "semester" in context
      ? Number((context as { semester: unknown }).semester)
      : null;
  const contextUniversity =
    typeof context === "object" && context != null && "university" in context
      ? String((context as { university: unknown }).university)
      : "";
  const contextMode =
    typeof context === "object" && context != null && "mode" in context
      ? String((context as { mode: unknown }).mode)
      : "";

  if (!semesterId) {
    return NextResponse.json({ error: "Missing semesterId" }, { status: 400 });
  }
  if (!Array.isArray(courses) || courses.length === 0) {
    return NextResponse.json({ error: "Missing courses" }, { status: 400 });
  }

  // Basic ownership check: semester must belong to authed user.
  // Note: during local development, migrations may not have been applied yet.
  // We gracefully fall back if the context columns don't exist.
  let sem:
    | {
        id: string;
        context_mode: string | null;
        context_university: string | null;
        context_year: number | null;
        context_semester: number | null;
      }
    | null = null;
  let semErr: { message?: string } | null = null;

  const semResNew = await supabase
    .from("semesters")
    .select("id, context_mode, context_university, context_year, context_semester")
    .eq("id", semesterId)
    .eq("user_id", user.id)
    .maybeSingle<{
      id: string;
      context_mode: string | null;
      context_university: string | null;
      context_year: number | null;
      context_semester: number | null;
    }>();

  const hasContextColumns = !semResNew.error;

  if (semResNew.error) {
    const semResOld = await supabase
      .from("semesters")
      .select("id")
      .eq("id", semesterId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();
    sem = semResOld.data
      ? {
          id: semResOld.data.id,
          context_mode: null,
          context_university: null,
          context_year: null,
          context_semester: null,
        }
      : null;
    // If the fallback query succeeded, ignore the original "missing column" error.
    semErr = semResOld.error;
  } else {
    sem = semResNew.data;
    semErr = null;
  }
  if (semErr || !sem) {
    return NextResponse.json(
      { error: semErr?.message ?? "Invalid semester" },
      { status: 400 },
    );
  }

  // Enforce course limit for free plan (server-side).
  const { data: userRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle<{ plan: string }>();
  const plan = userRow?.plan === "pro" ? "pro" : "free";

  if (plan !== "pro") {
    const { count, error: countErr } = await supabase
      .from("subject_enrolments")
      .select("id", { count: "exact", head: true })
      .eq("semester_id", semesterId);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 400 });
    }
    const existingCount = count ?? 0;
    if (existingCount + courses.length > FREE_MAX_COURSES_PER_SEMESTER) {
      return NextResponse.json(
        { error: "Upgrade to Pro to track more than 3 courses." },
        { status: 402 },
      );
    }
  }

  // If this semester already has a locked context, enforce it matches the request.
  if (sem.context_mode === "freeform") {
    if (contextMode && contextMode !== "freeform") {
      return NextResponse.json(
        { error: "This semester is locked to freeform courses." },
        { status: 400 },
      );
    }
  } else if (sem.context_mode === "scraper") {
    if (contextMode && contextMode !== "scraper") {
      return NextResponse.json(
        { error: "This semester is locked to scraped courses." },
        { status: 400 },
      );
    }
    if (
      contextYear != null &&
      Number.isFinite(contextYear) &&
      sem.context_year != null &&
      contextYear !== sem.context_year
    ) {
      return NextResponse.json(
        { error: "This semester is locked to a different year." },
        { status: 400 },
      );
    }
    if (
      contextSemester != null &&
      Number.isFinite(contextSemester) &&
      sem.context_semester != null &&
      contextSemester !== sem.context_semester
    ) {
      return NextResponse.json(
        { error: "This semester is locked to a different semester." },
        { status: 400 },
      );
    }
    if (
      contextUniversity &&
      sem.context_university != null &&
      contextUniversity.trim().toLowerCase() !==
        sem.context_university.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { error: "This semester is locked to a different university." },
        { status: 400 },
      );
    }
  }

  // If the semester has no context yet and we're adding the first course, lock it now.
  if (
    sem.context_mode == null &&
    sem.context_university == null &&
    sem.context_year == null &&
    sem.context_semester == null
  ) {
    const { count } = await supabase
      .from("subject_enrolments")
      .select("id", { count: "exact", head: true })
      .eq("semester_id", semesterId);
    const existingCount = count ?? 0;
    if (existingCount === 0) {
      // If the context columns don't exist yet (e.g. migrations not applied),
      // skip locking and just add the course(s).
      if (!hasContextColumns) {
        // no-op
      } else if (contextMode === "freeform") {
        const { error: lockErr } = await supabase
          .from("semesters")
          .update({ context_mode: "freeform" })
          .eq("id", semesterId)
          .eq("user_id", user.id);
        if (lockErr) {
          return NextResponse.json({ error: lockErr.message }, { status: 400 });
        }
      } else if (contextMode === "scraper") {
        const yearOk =
          contextYear != null &&
          Number.isFinite(contextYear) &&
          contextYear >= 2000 &&
          contextYear <= 2100;
        const semOk =
          contextSemester != null &&
          Number.isFinite(contextSemester) &&
          (contextSemester === 1 || contextSemester === 2);
        const uni = normalizeUniversityCode(contextUniversity);
        const uniOk = uni === "uq" || uni === "qut";
        if (yearOk && semOk && uniOk) {
          const { error: lockErr } = await supabase
            .from("semesters")
            .update({
              context_mode: "scraper",
              context_university: uni,
              context_year: contextYear,
              context_semester: contextSemester,
            })
            .eq("id", semesterId)
            .eq("user_id", user.id);
          if (lockErr) {
            return NextResponse.json({ error: lockErr.message }, { status: 400 });
          }
        } else {
          return NextResponse.json(
            { error: "Missing or invalid scraper context." },
            { status: 400 },
          );
        }
      }
    }
  }

  for (const raw of courses) {
    const c = raw as Partial<CoursePayload>;
    if (!c.courseCode || !c.courseName) {
      return NextResponse.json({ error: "Invalid course payload" }, { status: 400 });
    }

    const profile_url = profileUrlForDb(c.profileUrl);
    const university = normalizeUniversityCode(
      typeof c.university === "string" ? c.university : "",
    );

    const { data: enrol, error: enrolErr } = await supabase
      .from("subject_enrolments")
      .insert({
        semester_id: semesterId,
        course_code: String(c.courseCode).toUpperCase(),
        course_name: String(c.courseName),
        credit_points: Number(c.creditPoints ?? 2),
        target_grade: Number(c.targetGrade ?? 7),
        profile_url,
        university,
        hurdle_information:
          typeof c.hurdleInformation === "string" && c.hurdleInformation.trim()
            ? c.hurdleInformation.trim()
            : null,
      })
      .select("id")
      .single();

    if (enrolErr || !enrol?.id) {
      return NextResponse.json(
        { error: enrolErr?.message ?? "Could not add course" },
        { status: 400 },
      );
    }

    const assessments = Array.isArray(c.assessments) ? c.assessments : [];
    const rows = assessments
      .map((a) => ({
        subject_enrolment_id: enrol.id,
        assessment_name: String(a.assessmentName ?? "").trim(),
        weighting: Number(a.weighting ?? 0),
        mark: null,
        due_date: a.dueDate ?? null,
        is_hurdle: Boolean(a.isHurdle),
        hurdle_threshold:
          typeof a.hurdleThreshold === "number" && Number.isFinite(a.hurdleThreshold)
            ? Math.round(a.hurdleThreshold)
            : null,
        hurdle_requirements:
          typeof a.hurdleRequirements === "string" && a.hurdleRequirements.trim()
            ? a.hurdleRequirements.trim()
            : null,
      }))
      .filter((r) => r.assessment_name && Number.isFinite(r.weighting) && r.weighting > 0);

    if (rows.length) {
      const { error: aErr } = await supabase.from("assessment_results").insert(rows);
      if (aErr) {
        return NextResponse.json({ error: aErr.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

