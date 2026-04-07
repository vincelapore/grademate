import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  // Prevent open redirects: only allow relative in-app paths.
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const nextRaw = sp.next;
  const next =
    typeof nextRaw === "string" ? safeNext(nextRaw) : safeNext(undefined);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: semesters } = await supabase
      .from("semesters")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!semesters || semesters.length === 0) {
      redirect("/onboarding");
    }

    redirect(next ?? "/dashboard");
  }

  return <LoginClient />;
}
