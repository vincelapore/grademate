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

const FREE_MAX_COURSES_PER_SEMESTER = 4;

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (!semesterId) {
    return NextResponse.json({ error: "Missing semesterId" }, { status: 400 });
  }
  if (!Array.isArray(courses) || courses.length === 0) {
    return NextResponse.json({ error: "Missing courses" }, { status: 400 });
  }

  // Basic ownership check: semester must belong to authed user.
  const { data: sem, error: semErr } = await supabase
    .from("semesters")
    .select("id")
    .eq("id", semesterId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (semErr || !sem) {
    return NextResponse.json({ error: "Invalid semester" }, { status: 400 });
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
        { error: "Upgrade to Pro to track more than 4 courses." },
        { status: 402 },
      );
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

