import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const PERIOD_OPTIONS = [
  "Semester 1",
  "Semester 2",
  "Trimester 1",
  "Trimester 2",
  "Trimester 3",
  "Summer",
  "Winter",
] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

function isPeriod(x: unknown): x is Period {
  return typeof x === "string" && (PERIOD_OPTIONS as readonly string[]).includes(x);
}

async function requireOwnedSemester(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, semesterId: string) {
  const { data: sem, error } = await supabase
    .from("semesters")
    .select("id, user_id")
    .eq("id", semesterId)
    .maybeSingle<{ id: string; user_id: string }>();
  if (error) {
    return { error: error.message, status: 400 as const };
  }
  if (!sem || sem.user_id !== userId) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { sem, status: 200 as const };
}

export async function PATCH(request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid semester id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const owned = await requireOwnedSemester(supabase, user.id, id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const bodyUnknown = await request.json().catch(() => null);
  if (typeof bodyUnknown !== "object" || bodyUnknown == null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = bodyUnknown as Record<string, unknown>;

  const yearRaw = b.year;
  const periodRaw = b.period;
  const isCurrentRaw = b.is_current;
  const wantCurrent =
    typeof isCurrentRaw === "boolean" ? isCurrentRaw : Boolean(isCurrentRaw);

  const year =
    typeof yearRaw === "number" && Number.isInteger(yearRaw) ? yearRaw : NaN;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!isPeriod(periodRaw)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const period = periodRaw;

  // If this semester should be "current", unset any previous current semester first.
  if (wantCurrent) {
    await supabase
      .from("semesters")
      .update({ is_current: false })
      .eq("user_id", user.id)
      .eq("is_current", true);
  }
  const { error: upErr } = await supabase
    .from("semesters")
    .update({
      year,
      period,
      is_current: wantCurrent,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (upErr) {
    const msg = upErr.message;
    const maybeMissingPeriod =
      msg.toLowerCase().includes("period") &&
      (msg.toLowerCase().includes("column") ||
        msg.toLowerCase().includes("schema cache"));
    if (maybeMissingPeriod) {
      const { error: retryErr } = await supabase
        .from("semesters")
        .update({
          year,
          is_current: wantCurrent,
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (retryErr) {
        return NextResponse.json({ error: retryErr.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, partial: true });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid semester id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const owned = await requireOwnedSemester(supabase, user.id, id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const { data: enrols, error: enrolErr } = await supabase
    .from("subject_enrolments")
    .select("id")
    .eq("semester_id", id)
    .returns<Array<{ id: string }>>();
  if (enrolErr) {
    return NextResponse.json({ error: enrolErr.message }, { status: 400 });
  }
  const enrolmentIds = (enrols ?? []).map((e) => e.id);

  if (enrolmentIds.length) {
    const { error: delAssess } = await supabase
      .from("assessment_results")
      .delete()
      .in("subject_enrolment_id", enrolmentIds);
    if (delAssess) {
      return NextResponse.json({ error: delAssess.message }, { status: 400 });
    }

    const { error: delEnrol } = await supabase
      .from("subject_enrolments")
      .delete()
      .in("id", enrolmentIds);
    if (delEnrol) {
      return NextResponse.json({ error: delEnrol.message }, { status: 400 });
    }
  }

  const { error: delSem } = await supabase
    .from("semesters")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (delSem) {
    return NextResponse.json({ error: delSem.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

