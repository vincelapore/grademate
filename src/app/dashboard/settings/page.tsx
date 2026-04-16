import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncProFromStripeCheckoutSession } from "@/lib/stripe/syncCheckoutSession";
import { DashboardSettingsUpgrade } from "@/components/DashboardSettingsUpgrade";
import { DashboardCalendarReset } from "@/components/DashboardCalendarReset";
import { GmLogo } from "@/components/gm/GmLogo";
import { DashboardDeleteAccount } from "@/components/DashboardDeleteAccount";
import { DashboardSignOutButton } from "@/components/DashboardSignOutButton";
import { cookies } from "next/headers";
import pkg from "../../../../package.json";
import {
  DashboardAcademicProfileSettings,
  DashboardClearLocalDataRow,
  DashboardDefaultViewSetting,
  DashboardExportGradesRow,
  DashboardManageBillingButton,
  DashboardThemeSetting,
} from "@/components/DashboardSettingsActions";

export const dynamic = "force-dynamic";

type DbUser = {
  plan: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const resolvedSearch = await Promise.resolve(searchParams);
  const checkoutRaw = resolvedSearch?.checkout;
  const checkoutStatusEarly = Array.isArray(checkoutRaw)
    ? checkoutRaw[0]
    : checkoutRaw;
  const sessionIdRaw = resolvedSearch?.session_id;
  const sessionIdEarly = Array.isArray(sessionIdRaw)
    ? sessionIdRaw[0]
    : sessionIdRaw;

  if (
    checkoutStatusEarly === "success" &&
    typeof sessionIdEarly === "string" &&
    sessionIdEarly.startsWith("cs_")
  ) {
    const sync = await syncProFromStripeCheckoutSession(user.id, sessionIdEarly);
    if (sync.ok) {
      redirect("/dashboard/settings");
    }
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("plan, stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle<DbUser>();

  const plan = userRow?.plan === "pro" ? "pro" : "free";
  const hasStripeCustomer =
    typeof userRow?.stripe_customer_id === "string" &&
    userRow.stripe_customer_id.trim().length > 0;
  const hasStripeSubscription =
    typeof userRow?.stripe_subscription_id === "string" &&
    userRow.stripe_subscription_id.trim().startsWith("sub_");
  const canManageStripeBilling = hasStripeCustomer || hasStripeSubscription;
  const billingReturnRaw = resolvedSearch?.billing;
  const billingReturnStatus = Array.isArray(billingReturnRaw)
    ? billingReturnRaw[0]
    : billingReturnRaw;
  const checkoutStatus = checkoutStatusEarly;
  const email =
    user.email ??
    (typeof user.user_metadata?.email === "string"
      ? user.user_metadata.email
      : null);
  const provider = typeof user.app_metadata?.provider === "string"
    ? user.app_metadata.provider
    : null;
  const signInMethod =
    provider === "google"
      ? "Google"
      : provider === "email"
        ? "Email / password"
        : provider
          ? provider
          : "Grademate login";

  const cookieStore = await cookies();
  const themeInitial = cookieStore.get("gm_theme")?.value ?? null;
  const defaultViewInitial =
    cookieStore.get("gm_default_dashboard_view")?.value ?? null;
  const appVersion =
    (typeof process.env.NEXT_PUBLIC_APP_VERSION === "string" &&
    process.env.NEXT_PUBLIC_APP_VERSION.trim()
      ? process.env.NEXT_PUBLIC_APP_VERSION.trim()
      : null) ?? pkg.version;

  return (
    <main className="gm-container gm-dash-page" style={{ paddingTop: 14 }}>
      <header className="gm-dash-header-bar">
        <div className="gm-dash-header-left">
          <GmLogo href="/dashboard" />
          <Link href="/dashboard" className="gm-dash-settings-back">
            ← Dashboard
          </Link>
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

      {checkoutStatus === "success" ? (
        <p
          className="gm-dash-card"
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            fontSize: 14,
            color: "var(--color-text-secondary)",
            borderColor: "color-mix(in srgb, var(--color-text-primary) 12%, transparent)",
          }}
        >
          Thanks — your checkout completed. If Pro is not unlocked within a minute,
          refresh this page while we sync with Stripe.
        </p>
      ) : null}
      {checkoutStatus === "cancelled" ? (
        <p
          className="gm-dash-card"
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            fontSize: 14,
            color: "var(--color-text-secondary)",
            borderColor: "color-mix(in srgb, var(--color-text-primary) 12%, transparent)",
          }}
        >
          Checkout was cancelled. You can try again anytime from Upgrade below.
        </p>
      ) : null}
      {billingReturnStatus === "return" ? (
        <p
          className="gm-dash-card"
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            fontSize: 14,
            color: "var(--color-text-secondary)",
            borderColor: "color-mix(in srgb, var(--color-text-primary) 12%, transparent)",
          }}
        >
          You’re back from Stripe billing. If a change (like cancellation) is not
          reflected yet, wait a few seconds and refresh — webhooks can take a moment.
        </p>
      ) : null}

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
          <div className="gm-settings-stack">
            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Email</div>
                <div className="gm-settings-row-sub">
                  {email ?? "Signed in"}
                </div>
              </div>
            </div>

            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Sign-in method</div>
                <div className="gm-settings-row-sub">{signInMethod}</div>
              </div>
            </div>

            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Delete account</div>
                <div className="gm-settings-row-sub">
                  Permanently deletes your data.
                </div>
              </div>
              <DashboardDeleteAccount />
            </div>

            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Sign out</div>
                <div className="gm-settings-row-sub">
                  End your session on this device.
                </div>
              </div>
              <DashboardSignOutButton className="gm-dash-btn" />
            </div>
          </div>
        </section>

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
            Subscription
          </h2>
          <div className="gm-settings-stack">
            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Status</div>
                <div className="gm-settings-row-sub">
                  {plan === "pro" ? "Pro · Annual" : "Free"}
                </div>
              </div>
            </div>

            {plan !== "pro" ? (
              <div className="gm-settings-row">
                <div className="gm-settings-row-left">
                  <div className="gm-settings-row-title">Upgrade to Pro</div>
                  <div className="gm-settings-row-sub">
                    One plan: <strong>$29/year</strong> (about <strong>$2.42/mo</strong>).
                    Unlock multiple semesters, overall view, hell weeks, and more than
                    three courses per semester. At checkout you can enter promotion code{" "}
                    <strong>UQYEEHAW</strong> for the founding rate (
                    <strong>$19/year</strong>, first 100 redemptions).
                  </div>
                </div>
                <DashboardSettingsUpgrade />
              </div>
            ) : (
              <DashboardManageBillingButton
                disabled={!canManageStripeBilling}
                helper={
                  canManageStripeBilling
                    ? "Update your card, download invoices, or cancel your renewal. If you cancel, you keep Pro until the end of the billing period you already paid for."
                    : "Billing is not linked to this account yet. If you subscribed, try Upgrade once while logged in, or contact support with your receipt."
                }
              />
            )}
          </div>
        </section>

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
            Academic profile
          </h2>
          <DashboardAcademicProfileSettings />
        </section>

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
            App
          </h2>
          <div className="gm-settings-stack">
            <DashboardThemeSetting initial={themeInitial} />
            <DashboardDefaultViewSetting initial={defaultViewInitial} />
          </div>
        </section>

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
            Data
          </h2>
          <div className="gm-settings-stack">
            <DashboardExportGradesRow />
            <DashboardClearLocalDataRow />
          </div>
        </section>

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
            About
          </h2>
          <div className="gm-settings-stack">
            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Version</div>
                <div className="gm-settings-row-sub">{appVersion}</div>
              </div>
            </div>

            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Feedback / contact</div>
                <div className="gm-settings-row-sub">
                  Email us anytime.
                </div>
              </div>
              <a className="gm-dash-btn" href="mailto:hello@grademate.dev">
                Email
              </a>
            </div>

            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Privacy policy</div>
                <div className="gm-settings-row-sub">How we handle your data.</div>
              </div>
              <Link className="gm-dash-btn" href="/privacy">
                View
              </Link>
            </div>

            <div className="gm-settings-row">
              <div className="gm-settings-row-left">
                <div className="gm-settings-row-title">Terms</div>
                <div className="gm-settings-row-sub">The legal stuff.</div>
              </div>
              <Link className="gm-dash-btn" href="/terms">
                View
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
