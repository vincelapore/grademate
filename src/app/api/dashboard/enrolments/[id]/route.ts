import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Delete a subject enrolment and its assessments. Runs on the server so the
 * browser never calls Supabase with a key (avoids "Forbidden use of secret API key in browser").
 */
export async function DELETE(_request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: enrol, error: enrolErr } = await supabase
    .from("subject_enrolments")
    .select("id, semester_id")
    .eq("id", id)
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

  const { error: delA } = await supabase
    .from("assessment_results")
    .delete()
    .eq("subject_enrolment_id", id);
  if (delA) {
    return NextResponse.json({ error: delA.message }, { status: 400 });
  }

  const { error: delE } = await supabase
    .from("subject_enrolments")
    .delete()
    .eq("id", id);
  if (delE) {
    return NextResponse.json({ error: delE.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
  }

  const bodyUnknown = await request.json().catch(() => null);
  if (typeof bodyUnknown !== "object" || bodyUnknown == null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const tg = (bodyUnknown as { target_grade?: unknown }).target_grade;
  if (typeof tg !== "number" || !Number.isInteger(tg) || tg < 1 || tg > 7) {
    return NextResponse.json({ error: "target_grade must be 1–7" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: enrol, error: enrolErr } = await supabase
    .from("subject_enrolments")
    .select("id, semester_id")
    .eq("id", id)
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
    .from("subject_enrolments")
    .update({ target_grade: tg })
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
