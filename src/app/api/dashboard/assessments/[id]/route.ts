import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  aggregateSubAssessmentMarks,
  formatAggregateMarkForStorage,
} from "@/lib/grades";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

type SubAssessmentRowPayload = {
  name: string;
  mark: string | null;
  weight?: number;
};

type SubAssessmentsPayload = {
  rows: SubAssessmentRowPayload[];
  bestOf?: number | null;
};

function parseMarkField(raw: unknown): { mark: string | null } | { error: string } {
  if (raw == null) return { mark: null };
  if (typeof raw !== "string") return { error: "mark must be a string or null" };
  const t = raw.trim();
  if (!t) return { mark: null };
  if (t.length > 32) return { error: "mark is too long" };
  return { mark: t };
}

function parseSubAssessmentsField(
  raw: unknown,
): { sub_assessments: SubAssessmentsPayload | null } | { error: string } {
  if (raw == null) return { sub_assessments: null };
  if (typeof raw !== "object" || raw == null) {
    return { error: "sub_assessments must be an object or null" };
  }
  const obj = raw as Record<string, unknown>;
  const rows = obj.rows;
  const bestOfRaw = obj.bestOf;
  if (!Array.isArray(rows)) {
    return { error: "sub_assessments.rows must be an array" };
  }
  if (rows.length > 24) {
    return { error: "Too many parts (max 24)" };
  }
  const parsedRows: SubAssessmentRowPayload[] = [];
  for (const r of rows) {
    if (typeof r !== "object" || r == null) {
      return { error: "Each part must be an object" };
    }
    const rr = r as Record<string, unknown>;
    const nameRaw = rr.name;
    const markRaw = rr.mark;
    const weightRaw = rr.weight;
    if (typeof nameRaw !== "string" || !nameRaw.trim()) {
      return { error: "Each part needs a name" };
    }
    if (nameRaw.length > 80) return { error: "Part name is too long" };

    const parsedMark = parseMarkField(markRaw);
    if ("error" in parsedMark) return parsedMark;

    let weight: number | undefined = undefined;
    if (weightRaw != null) {
      if (typeof weightRaw !== "number" || !Number.isFinite(weightRaw)) {
        return { error: "Part weight must be a number" };
      }
      weight = weightRaw;
    }
    parsedRows.push({ name: nameRaw.trim(), mark: parsedMark.mark, weight });
  }
  let bestOf: number | null | undefined = undefined;
  if (bestOfRaw != null) {
    if (
      typeof bestOfRaw !== "number" ||
      !Number.isFinite(bestOfRaw) ||
      !Number.isInteger(bestOfRaw)
    ) {
      return { error: "bestOf must be an integer" };
    }
    if (bestOfRaw < 1 || bestOfRaw > parsedRows.length) {
      return { error: "bestOf must be between 1 and the number of parts" };
    }
    bestOf = bestOfRaw;
  }
  return { sub_assessments: { rows: parsedRows, ...(bestOf != null ? { bestOf } : {}) } };
}

function parsePatchPayload(
  bodyUnknown: unknown,
): { mark?: string | null; sub_assessments?: SubAssessmentsPayload | null } | { error: string } {
  if (typeof bodyUnknown !== "object" || bodyUnknown == null) {
    return { error: "Invalid JSON body" };
  }
  const b = bodyUnknown as Record<string, unknown>;
  const out: { mark?: string | null; sub_assessments?: SubAssessmentsPayload | null } = {};

  if ("mark" in b) {
    const parsed = parseMarkField(b.mark);
    if ("error" in parsed) return parsed;
    out.mark = parsed.mark;
  }

  if ("sub_assessments" in b) {
    const parsed = parseSubAssessmentsField(b.sub_assessments);
    if ("error" in parsed) return parsed;
    out.sub_assessments = parsed.sub_assessments;
  }

  if (!("mark" in out) && !("sub_assessments" in out)) {
    return { error: "Nothing to update" };
  }
  return out;
}

function computedMarkFromComponents(
  sub: SubAssessmentsPayload | null | undefined,
): string | null {
  if (!sub?.rows?.length) return null;
  const agg = aggregateSubAssessmentMarks(
    sub.rows.map((r) => ({
      mark: r.mark,
      weight:
        typeof r.weight === "number" && !Number.isNaN(r.weight) ? r.weight : 0,
    })),
    sub.bestOf,
  );
  return formatAggregateMarkForStorage(agg);
}

export async function PATCH(request: Request, context: RouteCtx) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid assessment id" }, { status: 400 });
  }

  const bodyUnknown = await request.json().catch(() => null);
  const parsed = parsePatchPayload(bodyUnknown);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

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

  const update: Record<string, unknown> = {};
  if ("mark" in parsed) update.mark = parsed.mark;
  if ("sub_assessments" in parsed) {
    update.sub_assessments = parsed.sub_assessments;
    // If components exist, mark becomes derived from them.
    // When cleared (null), we leave mark as-is so users can go back to manual entry.
    const derived = computedMarkFromComponents(parsed.sub_assessments);
    if (derived != null) update.mark = derived;
  }

  const { error: upErr } = await supabase
    .from("assessment_results")
    .update(update)
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
