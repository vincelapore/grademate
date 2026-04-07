import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GmShell } from "@/components/gm/GmShell";
import "../university/gm-university.css";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/dashboard");

  const { data: semesters } = await supabase
    .from("semesters")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!semesters || semesters.length === 0) redirect("/onboarding");

  return (
    <GmShell variant="app" showFooter={false} showNav={false}>
      {children}
    </GmShell>
  );
}

