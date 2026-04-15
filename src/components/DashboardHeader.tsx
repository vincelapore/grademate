"use client";

import Link from "next/link";
import { useState } from "react";
import { Bug, Settings } from "lucide-react";
import { Menu, X } from "lucide-react";
import { GmLogo } from "@/components/gm/GmLogo";
import { UpgradeModal } from "@/components/UpgradeModal";

export function DashboardHeader({
  activeView,
  calendarSubscribe,
  plan,
  overallLocked,
  semesterCount,
}: {
  activeView: "home" | "semester" | "overall";
  calendarSubscribe?: {
    feedUrl: string;
    plan: "free" | "pro";
  } | null;
  plan: "free" | "pro";
  overallLocked: boolean;
  semesterCount?: number;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          <nav className="gm-dash-tabs gm-dash-desktop-only" aria-label="Dashboard views">
            <Link
              href="/dashboard"
              className={
                activeView === "home"
                  ? "gm-dash-tab gm-dash-tab--active"
                  : "gm-dash-tab"
              }
              aria-current={activeView === "home" ? "page" : undefined}
            >
              Home
            </Link>
            <Link
              href="/dashboard?view=semester"
              className={
                activeView === "semester"
                  ? "gm-dash-tab gm-dash-tab--active"
                  : "gm-dash-tab"
              }
              aria-current={activeView === "semester" ? "page" : undefined}
            >
              Semester
            </Link>
            {overallLocked ? (
              <button
                type="button"
                className={
                  activeView === "overall"
                    ? "gm-dash-tab gm-dash-tab--active"
                    : "gm-dash-tab"
                }
                aria-current={activeView === "overall" ? "page" : undefined}
                onClick={() => setUpgradeOpen(true)}
              >
                Overall
              </button>
            ) : (
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
            )}
          </nav>
        </div>

        <div className="gm-dash-header-right">
          {plan !== "pro" ? (
            <button
              type="button"
              className="gm-dash-btn gm-dash-desktop-only"
              onClick={() => setUpgradeOpen(true)}
            >
              Upgrade
            </button>
          ) : null}
          <a
            className="gm-dash-icon-btn gm-dash-desktop-only"
            href={mailto}
            aria-label="Report bug"
            title="Report bug"
          >
            <Bug className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          </a>
          <Link
            href="/dashboard/settings"
            className="gm-dash-icon-btn gm-dash-desktop-only"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          </Link>

          <button
            type="button"
            className="gm-dash-icon-btn gm-dash-mobile-only"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <X className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            )}
          </button>
        </div>

        {menuOpen ? (
          <div className="gm-dash-mobile-menu-wrap" role="dialog" aria-label="Menu">
            <div className="gm-dash-menu">
              <Link className="gm-dash-menu-item" href="/dashboard" onClick={() => setMenuOpen(false)}>
                Home
              </Link>
              <Link
                className="gm-dash-menu-item"
                href="/dashboard?view=semester"
                onClick={() => setMenuOpen(false)}
              >
                Semester
              </Link>
              {overallLocked ? (
                <button
                  type="button"
                  className="gm-dash-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setUpgradeOpen(true);
                  }}
                >
                  Overall
                </button>
              ) : (
                <Link
                  className="gm-dash-menu-item"
                  href="/dashboard?view=overall"
                  onClick={() => setMenuOpen(false)}
                >
                  Overall
                </Link>
              )}
              {plan !== "pro" ? (
                <button
                  type="button"
                  className="gm-dash-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setUpgradeOpen(true);
                  }}
                >
                  Upgrade
                </button>
              ) : null}
              <a className="gm-dash-menu-item" href={mailto} onClick={() => setMenuOpen(false)}>
                Report bug
              </a>
              <Link
                className="gm-dash-menu-item"
                href="/dashboard/settings"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
            </div>
          </div>
        ) : null}
      </header>
      {upgradeOpen ? (
        <UpgradeModal
          reason={overallLocked ? "overall" : "generic"}
          semesterCount={semesterCount}
          onClose={() => setUpgradeOpen(false)}
        />
      ) : null}
    </>
  );
}
