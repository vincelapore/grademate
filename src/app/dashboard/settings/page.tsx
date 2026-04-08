import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardSignOutButton } from "@/components/DashboardSignOutButton";
import { DashboardSettingsUpgrade } from "@/components/DashboardSettingsUpgrade";
import { DashboardCalendarReset } from "@/components/DashboardCalendarReset";
import { GmLogo } from "@/components/gm/GmLogo";
import { DashboardDeleteAccount } from "@/components/DashboardDeleteAccount";

export const dynamic = "force-dynamic";

type DbUser = {
  plan: string | null;
};

export default async function DashboardSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle<DbUser>();

  const plan = userRow?.plan === "pro" ? "pro" : "free";
  const email =
    user.email ??
    (typeof user.user_metadata?.email === "string"
      ? user.user_metadata.email
      : null);

  return (
    <main className="gm-container gm-dash-page" style={{ paddingTop: 20 }}>
      <header className="gm-dash-header-bar">
        <div className="gm-dash-header-left">
          <GmLogo href="/dashboard" />
          <Link href="/dashboard" className="gm-dash-settings-back">
            ← Dashboard
          </Link>
        </div>
        <div className="gm-dash-header-right">
          <DashboardSignOutButton className="gm-dash-btn" />
        </div>
      </header>

      <h1
        style={{
          margin: "8px 0 20px",
          fontSize: "1.5rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        Settings
      </h1>

      <div className="gm-dash-settings-stack">
        <section className="gm-dash-card">
          <h2
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-text-tertiary)",
            }}
          >
            Account
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 15,
              fontWeight: 500,
              color: "var(--color-text-primary)",
            }}
          >
            {email ?? "Signed in"}
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "var(--color-text-tertiary)",
            }}
          >
            Managed with your Grademate login.
          </p>
          <div style={{ marginTop: 14 }}>
            <DashboardDeleteAccount />
          </div>
        </section>

        {/* <section className="gm-dash-card">
          <h2
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-text-tertiary)",
            }}
          >
            Plan
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            {plan === "pro" ? "Pro" : "Free"}
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--color-text-secondary)",
            }}
          >
            {plan === "pro" ? (
              <>
                You have access to Pro features, including multiple semesters.
              </>
            ) : (
              <>
                You are on the Free plan. Upgrade for multiple semesters and
                more coming soon.
              </>
            )}
          </p>
          {plan !== "pro" ? (
            <div style={{ marginTop: 14 }}>
              <DashboardSettingsUpgrade />
            </div>
          ) : null}
        </section> */}

        <section className="gm-dash-card">
          <h2
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-text-tertiary)",
            }}
          >
            Calendar
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--color-text-secondary)",
            }}
          >
            Subscribe from the dashboard with the calendar button. Reset your
            secret link if it was shared accidentally.
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13,
              lineHeight: 1.45,
              color: "var(--color-text-tertiary)",
            }}
          >
            This will break any existing calendar subscriptions.
          </p>
          <div style={{ marginTop: 12 }}>
            <DashboardCalendarReset />
          </div>
        </section>
      </div>
    </main>
  );
}
