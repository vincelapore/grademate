import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function parseMarkPayload(
  bodyUnknown: unknown,
): { mark: string | null } | { error: string } {
  if (typeof bodyUnknown !== "object" || bodyUnknown == null) {
    return { error: "Invalid JSON body" };
  }
  const b = bodyUnknown as Record<string, unknown>;
  const raw = b.mark;
  if (raw == null) return { mark: null };
  if (typeof raw !== "string") return { error: "mark must be a string or null" };
  const t = raw.trim();
  if (!t) return { mark: null };
  if (t.length > 32) return { error: "mark is too long" };
  return { mark: t };
}

export async function PATCH(request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid assessment id" }, { status: 400 });
  }

  const bodyUnknown = await request.json().catch(() => null);
  const parsed = parseMarkPayload(bodyUnknown);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { mark } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: assessment, error: aErr } = await supabase
    .from("assessment_results")
    .select("id, subject_enrolment_id")
    .eq("id", id)
    .maybeSingle();

  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 400 });
  }
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const { data: enrol, error: enrolErr } = await supabase
    .from("subject_enrolments")
    .select("id, semester_id")
    .eq("id", assessment.subject_enrolment_id)
    .maybeSingle();

  if (enrolErr) {
    return NextResponse.json({ error: enrolErr.message }, { status: 400 });
  }
  if (!enrol) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { data: semester, error: semErr } = await supabase
    .from("semesters")
    .select("user_id")
    .eq("id", enrol.semester_id)
    .maybeSingle();

  if (semErr) {
    return NextResponse.json({ error: semErr.message }, { status: 400 });
  }
  if (!semester || semester.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: upErr } = await supabase
    .from("assessment_results")
    .update({ mark })
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
