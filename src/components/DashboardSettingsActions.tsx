"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import posthog from "posthog-js";

function setCookie(name: string, value: string, days = 365) {
  const maxAge = Math.floor(days * 24 * 60 * 60);
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function DashboardThemeSetting({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<"system" | "light" | "dark">(() => {
    return initial === "light" || initial === "dark" || initial === "system"
      ? initial
      : "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = value;
    setCookie("gm_theme", value);
  }, [value]);

  return (
    <div className="gm-settings-row">
      <div className="gm-settings-row-left">
        <div className="gm-settings-row-title">Theme</div>
        <div className="gm-settings-row-sub">Light, dark, or follow your system.</div>
      </div>
      <select
        className="gm-dash-select"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v === "light" || v === "dark" ? v : "system");
        }}
        aria-label="Theme"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}

export function DashboardDefaultViewSetting({
  initial,
}: {
  initial: string | null;
}) {
  const [value, setValue] = useState<"semester" | "home">(() => {
    return initial === "semester" || initial === "home" ? initial : "home";
  });

  useEffect(() => {
    setCookie("gm_default_dashboard_view", value);
  }, [value]);

  return (
    <div className="gm-settings-row">
      <div className="gm-settings-row-left">
        <div className="gm-settings-row-title">Default semester view</div>
        <div className="gm-settings-row-sub">
          Choose what opens when you visit the dashboard.
        </div>
      </div>
      <select
        className="gm-dash-select"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v === "semester" ? "semester" : "home");
        }}
        aria-label="Default dashboard view"
      >
        <option value="semester">Current semester</option>
        <option value="home">All semesters</option>
      </select>
    </div>
  );
}

export function DashboardAcademicProfileSettings() {
  const [university, setUniversity] = useState<"uq" | "qut">("uq");
  const [degreeName, setDegreeName] = useState("");

  useEffect(() => {
    try {
      const u = window.localStorage.getItem("gm_default_university");
      const d = window.localStorage.getItem("gm_degree_name");
      startTransition(() => {
        if (u === "uq" || u === "qut") setUniversity(u);
        if (typeof d === "string") setDegreeName(d);
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("gm_default_university", university);
    } catch {
      // ignore
    }
  }, [university]);

  useEffect(() => {
    try {
      const trimmed = degreeName.trim();
      if (trimmed) window.localStorage.setItem("gm_degree_name", trimmed);
      else window.localStorage.removeItem("gm_degree_name");
    } catch {
      // ignore
    }
  }, [degreeName]);

  const gradingLabel = useMemo(() => "7-point (MVP)", []);

  return (
    <div className="gm-settings-stack">
      <div className="gm-settings-row">
        <div className="gm-settings-row-left">
          <div className="gm-settings-row-title">Default university</div>
          <div className="gm-settings-row-sub">Used to pre-fill the scraper.</div>
        </div>
        <select
          className="gm-dash-select"
          value={university}
          onChange={(e) => setUniversity(e.target.value === "qut" ? "qut" : "uq")}
          aria-label="Default university"
        >
          <option value="uq">UQ</option>
          <option value="qut" disabled>
            QUT (coming soon)
          </option>
        </select>
      </div>

      <div className="gm-settings-row">
        <div className="gm-settings-row-left">
          <div className="gm-settings-row-title">Degree name</div>
          <div className="gm-settings-row-sub">
            Optional. Display only for now.
          </div>
        </div>
        <input
          className="gm-dash-input"
          value={degreeName}
          onChange={(e) => setDegreeName(e.target.value)}
          placeholder="e.g. Bachelor of Engineering"
          aria-label="Degree name"
        />
      </div>

      <div className="gm-settings-row">
        <div className="gm-settings-row-left">
          <div className="gm-settings-row-title">Grading system</div>
          <div className="gm-settings-row-sub">More systems are coming.</div>
        </div>
        <select className="gm-dash-select" value={gradingLabel} disabled>
          <option value={gradingLabel}>{gradingLabel}</option>
        </select>
      </div>
    </div>
  );
}

export function DashboardManageBillingButton({
  disabled,
  helper,
  title = "Manage subscription",
  buttonLabel = "Open billing portal",
}: {
  disabled?: boolean;
  helper?: string;
  title?: string;
  buttonLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        throw new Error(
          typeof json.error === "string" && json.error
            ? json.error
            : `Could not open billing (${res.status})`,
        );
      }
      posthog.capture("billing_portal_opened");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open billing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gm-settings-row">
      <div className="gm-settings-row-left">
        <div className="gm-settings-row-title">{title}</div>
        <div className="gm-settings-row-sub">
          {helper ??
            "Payment method, invoices, and cancellation are handled in Stripe’s customer portal."}
        </div>
        {error ? (
          <div className="gm-settings-row-error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="gm-dash-btn"
        disabled={disabled || busy}
        onClick={() => void openPortal()}
      >
        {busy ? "Opening…" : buttonLabel}
      </button>
    </div>
  );
}

export function DashboardExportGradesRow() {
  return (
    <div className="gm-settings-row">
      <div className="gm-settings-row-left">
        <div className="gm-settings-row-title">Export grades (CSV)</div>
        <div className="gm-settings-row-sub">
          Download a CSV of your semesters, courses, and assessments.
        </div>
      </div>
      <a
        className="gm-dash-btn"
        href="/api/dashboard/export/grades"
        onClick={() => posthog.capture("grades_exported")}
      >
        Download
      </a>
    </div>
  );
}

export function DashboardClearLocalDataRow() {
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {
      // ignore
    } finally {
      deleteCookie("gm_theme");
      deleteCookie("gm_default_dashboard_view");
      window.location.reload();
    }
  }

  return (
    <div className="gm-settings-row">
      <div className="gm-settings-row-left">
        <div className="gm-settings-row-title">Clear local data</div>
        <div className="gm-settings-row-sub">
          Removes device-only preferences and cached form data.
        </div>
      </div>
      <button
        type="button"
        className="gm-dash-modal-btn gm-dash-modal-btn--danger"
        disabled={busy}
        onClick={() => void clear()}
      >
        {busy ? "Clearing…" : "Clear"}
      </button>
    </div>
  );
}

