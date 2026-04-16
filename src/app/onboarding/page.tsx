import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSemester } from "@/lib/semester";
import { GmShell } from "@/components/gm/GmShell";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/onboarding");

  const { data: semesters } = await supabase
    .from("semesters")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (semesters && semesters.length > 0) redirect("/dashboard");

  const current = getCurrentSemester();

  return (
    <GmShell variant="app" showFooter={false}>
      <main className="gm-container" style={{ maxWidth: 720 }}>
        <OnboardingFlow initialSemester={current} />
      </main>
    </GmShell>
  );
}

