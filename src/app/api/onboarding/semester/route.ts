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

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  const semesterInt = semesterLabelToInt(semester);
  if (!semesterInt) {
    return NextResponse.json({ error: "Invalid semester" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("semesters")
    .insert({ user_id: user.id, year, semester: semesterInt })
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

