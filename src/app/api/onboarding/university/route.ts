import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bodyUnknown: unknown = await request.json().catch(() => null);
  const university =
    typeof bodyUnknown === "object" && bodyUnknown != null && "university" in bodyUnknown
      ? String((bodyUnknown as { university: unknown }).university)
      : null;

  if (university !== "uq") {
    return NextResponse.json({ error: "Invalid university" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .upsert({ id: user.id, email: user.email ?? null, university });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

