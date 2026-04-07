import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e: unknown) {
    const msg =
      e instanceof Error && e.message ? e.message : "Service role unavailable";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const userId = user.id;

  // Best-effort cleanup in FK-safe order. Service role bypasses RLS.
  const { data: semesters } = await admin
    .from("semesters")
    .select("id")
    .eq("user_id", userId)
    .returns<{ id: string }[]>();

  const semesterIds = (semesters ?? []).map((s) => s.id);

  if (semesterIds.length) {
    const { data: enrols } = await admin
      .from("subject_enrolments")
      .select("id")
      .in("semester_id", semesterIds)
      .returns<{ id: string }[]>();

    const enrolmentIds = (enrols ?? []).map((e) => e.id);

    if (enrolmentIds.length) {
      const { error: delAssess } = await admin
        .from("assessment_results")
        .delete()
        .in("subject_enrolment_id", enrolmentIds);
      if (delAssess) {
        return NextResponse.json({ error: delAssess.message }, { status: 400 });
      }

      const { error: delEnrol } = await admin
        .from("subject_enrolments")
        .delete()
        .in("id", enrolmentIds);
      if (delEnrol) {
        return NextResponse.json({ error: delEnrol.message }, { status: 400 });
      }
    }

    const { error: delSem } = await admin
      .from("semesters")
      .delete()
      .in("id", semesterIds);
    if (delSem) {
      return NextResponse.json({ error: delSem.message }, { status: 400 });
    }
  }

  // Delete any saved course rows (if present in this project)
  await admin.from("saved_courses").delete().eq("user_id", userId);

  const { error: delUserRow } = await admin.from("users").delete().eq("id", userId);
  if (delUserRow) {
    return NextResponse.json({ error: delUserRow.message }, { status: 400 });
  }

  const { error: delAuth } = await admin.auth.admin.deleteUser(userId);
  if (delAuth) {
    return NextResponse.json({ error: delAuth.message }, { status: 400 });
  }

  // Clear session cookies
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}

