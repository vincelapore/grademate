"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Copy } from "lucide-react";

export function DashboardCalendarSubscribe({
  feedUrl,
  plan,
}: {
  feedUrl: string;
  plan: "free" | "pro";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;

  return (
    <div className="gm-dash-cal-subscribe-wrap" ref={rootRef}>
      <button
        type="button"
        className="gm-dash-icon-btn"
        aria-label="Subscribe to calendar"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarDays size={20} strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <div className="gm-dash-cal-popover" role="dialog" aria-label="Calendar subscription">
          <h2 className="gm-dash-cal-popover-title">Subscribe to your calendar</h2>
          <p className="gm-dash-cal-popover-body">
            Add your assessments to Google Calendar, Apple Calendar, or Outlook.
            Updates automatically.
          </p>
          <div className="gm-dash-cal-popover-field">
            <input
              type="text"
              readOnly
              className="gm-dash-cal-popover-input"
              value={feedUrl}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="gm-dash-cal-popover-copy"
              aria-label={copied ? "Copied" : "Copy calendar URL"}
              onClick={() => void copy()}
            >
              {copied ? (
                <Check size={18} strokeWidth={1.75} aria-hidden />
              ) : (
                <Copy size={18} strokeWidth={1.75} aria-hidden />
              )}
            </button>
          </div>
          <div className="gm-dash-cal-popover-links">
            <a href={googleUrl} target="_blank" rel="noopener noreferrer">
              Add to Google Calendar ↗
            </a>
            <a href={feedUrl} target="_blank" rel="noopener noreferrer">
              Add to Apple Calendar ↗
            </a>
          </div>
          {plan === "free" ? (
            <p className="gm-dash-cal-popover-foot">
              Pro includes exam periods and semester milestones
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
