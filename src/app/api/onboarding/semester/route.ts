import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function semesterLabelToInt(label: string): number | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === "1" || normalized === "sem 1" || normalized === "semester 1")
    return 1;
  if (normalized === "2" || normalized === "sem 2" || normalized === "semester 2")
    return 2;
  return null;
}

function nextUnusedYearSemester(pairs: Array<{ year: number; semester: number }>): {
  year: number;
  semester: number;
} {
  if (!pairs.length) {
    const y = new Date().getFullYear();
    return { year: y, semester: 1 };
  }
  // Find max (year, semester) and increment.
  let maxYear = pairs[0]!.year;
  let maxSem = pairs[0]!.semester;
  for (const p of pairs) {
    if (p.year > maxYear || (p.year === maxYear && p.semester > maxSem)) {
      maxYear = p.year;
      maxSem = p.semester;
    }
  }
  if (maxSem >= 2) return { year: maxYear + 1, semester: 1 };
  return { year: maxYear, semester: 2 };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bodyUnknown: unknown = await request.json().catch(() => null);
  const year =
    typeof bodyUnknown === "object" && bodyUnknown != null && "year" in bodyUnknown
      ? Number((bodyUnknown as { year: unknown }).year)
      : NaN;
  const semester =
    typeof bodyUnknown === "object" && bodyUnknown != null && "semester" in bodyUnknown
      ? String((bodyUnknown as { semester: unknown }).semester)
      : "";
  const name =
    typeof bodyUnknown === "object" && bodyUnknown != null && "name" in bodyUnknown
      ? String((bodyUnknown as { name: unknown }).name)
      : "";
  const auto =
    typeof bodyUnknown === "object" && bodyUnknown != null && "auto" in bodyUnknown
      ? Boolean((bodyUnknown as { auto: unknown }).auto)
      : false;

  // If `auto` is set, we pick a unique (year, semester) behind the scenes.
  let resolvedYear = year;
  let resolvedSemesterInt = semesterLabelToInt(semester);
  if (auto) {
    const { data: existingPairs, error: pairsErr } = await supabase
      .from("semesters")
      .select("year, semester")
      .eq("user_id", user.id)
      .returns<Array<{ year: number; semester: number }>>();
    if (pairsErr) {
      return NextResponse.json({ error: pairsErr.message }, { status: 400 });
    }
    const next = nextUnusedYearSemester(existingPairs ?? []);
    resolvedYear = next.year;
    resolvedSemesterInt = next.semester;
  } else {
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (!resolvedSemesterInt) {
      return NextResponse.json({ error: "Invalid semester" }, { status: 400 });
    }
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle<{ plan: string | null }>();
  const plan = userRow?.plan === "pro" ? "pro" : "free";

  if (plan !== "pro") {
    // Free plan may create the first semester for onboarding.
    const { count, error: cntErr } = await supabase
      .from("semesters")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (cntErr) {
      return NextResponse.json({ error: cntErr.message }, { status: 400 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Upgrade to Pro to add more than 1 semester." },
        { status: 402 },
      );
    }
  }

  const { data, error } = await supabase
    .from("semesters")
    .insert({
      user_id: user.id,
      year: resolvedYear,
      semester: resolvedSemesterInt!,
      ...(name.trim() ? { name: name.trim() } : {}),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create semester" },
      { status: 400 },
    );
  }

  return NextResponse.json({ id: data.id });
}

export async function PATCH(request: Request) {
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
  const context =
    typeof bodyUnknown === "object" && bodyUnknown != null && "context" in bodyUnknown
      ? ((bodyUnknown as { context: unknown }).context as unknown)
      : null;

  const mode =
    typeof context === "object" && context != null && "mode" in context
      ? String((context as { mode: unknown }).mode)
      : "";
  const university =
    typeof context === "object" && context != null && "university" in context
      ? String((context as { university: unknown }).university).toLowerCase()
      : "";
  const year =
    typeof context === "object" && context != null && "year" in context
      ? Number((context as { year: unknown }).year)
      : NaN;
  const semesterInt =
    typeof context === "object" && context != null && "semester" in context
      ? Number((context as { semester: unknown }).semester)
      : NaN;

  if (!semesterId) {
    return NextResponse.json({ error: "Missing semesterId" }, { status: 400 });
  }

  // Only support locking scraper context right now.
  if (mode !== "scraper") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  if (university !== "uq") {
    return NextResponse.json({ error: "Unsupported university" }, { status: 400 });
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!(semesterInt === 1 || semesterInt === 2)) {
    return NextResponse.json({ error: "Invalid semester" }, { status: 400 });
  }

  // Only allow locking if user owns semester and it has no enrolments yet.
  // Note: the context columns may not exist yet in some environments.
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

  const semResOld = semResNew.error
    ? await supabase
        .from("semesters")
        .select("id")
        .eq("id", semesterId)
        .eq("user_id", user.id)
        .maybeSingle<{ id: string }>()
    : null;

  const sem =
    semResNew.error && semResOld?.data
      ? {
          id: semResOld.data.id,
          context_mode: null,
          context_university: null,
          context_year: null,
          context_semester: null,
        }
      : semResNew.data ?? null;

  const semErr = semResNew.error ? semResOld?.error : null;

  if (semErr || !sem) {
    return NextResponse.json(
      { error: semErr?.message ?? "Invalid semester" },
      { status: 400 },
    );
  }

  // If already locked, just acknowledge.
  if (sem.context_mode || sem.context_university || sem.context_year || sem.context_semester) {
    return NextResponse.json({ ok: true, locked: true });
  }

  const { count, error: cntErr } = await supabase
    .from("subject_enrolments")
    .select("id", { count: "exact", head: true })
    .eq("semester_id", semesterId);
  if (cntErr) {
    return NextResponse.json({ error: cntErr.message }, { status: 400 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, locked: true });
  }

  // If the context columns don't exist yet, treat lock as a no-op.
  if (semResNew.error) {
    return NextResponse.json({ ok: true, locked: false });
  }

  const { error: updErr } = await supabase
    .from("semesters")
    .update({
      context_mode: "scraper",
      context_university: "uq",
      context_year: year,
      context_semester: semesterInt,
    })
    .eq("id", semesterId)
    .eq("user_id", user.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, locked: true });
}

