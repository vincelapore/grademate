"use client";

import Link from "next/link";
import { DashboardSignOutButton } from "@/components/DashboardSignOutButton";
import { GmLogo } from "@/components/gm/GmLogo";
import { DashboardCalendarSubscribe } from "@/components/DashboardCalendarSubscribe";

export function DashboardHeader({
  activeView,
  calendarSubscribe,
}: {
  activeView: "semester" | "overall";
  calendarSubscribe?: {
    feedUrl: string;
    plan: "free" | "pro";
  } | null;
}) {
  const mailto = (() => {
    const subject = "GradeMate feedback";
    const body = ["Hello,", " "].join("\n");
    return `mailto:vincemlapore@gmail.com?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  })();

  return (
    <>
      <header className="gm-dash-header-bar">
        <div className="gm-dash-header-left">
          <GmLogo href="/dashboard" />
          <nav className="gm-dash-tabs" aria-label="Dashboard views">
            <Link
              href="/dashboard"
              className={
                activeView === "semester"
                  ? "gm-dash-tab gm-dash-tab--active"
                  : "gm-dash-tab"
              }
              aria-current={activeView === "semester" ? "page" : undefined}
            >
              Current
            </Link>
            <Link
              href="/dashboard?view=overall"
              className={
                activeView === "overall"
                  ? "gm-dash-tab gm-dash-tab--active"
                  : "gm-dash-tab"
              }
              aria-current={activeView === "overall" ? "page" : undefined}
            >
              Overall
            </Link>
          </nav>
        </div>

        <div className="gm-dash-header-right">
          {calendarSubscribe ? (
            <DashboardCalendarSubscribe
              feedUrl={calendarSubscribe.feedUrl}
              plan={calendarSubscribe.plan}
            />
          ) : null}
          <a className="gm-dash-btn" href={mailto}>
            Report bug
          </a>
          <Link href="/dashboard/settings" className="gm-dash-btn">
            Settings
          </Link>
          <DashboardSignOutButton className="gm-dash-btn" />
        </div>
      </header>
    </>
  );
}
