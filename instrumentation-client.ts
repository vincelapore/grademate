import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (typeof window !== "undefined" && token && token.trim()) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    // Exception Autocapture loads an extra script; in dev it’s commonly blocked
    // (adblock/CSP/local rewrites) and triggers noisy console errors.
    capture_exceptions: process.env.NODE_ENV === "production",
    // Surveys also load an extra script; disable in dev to avoid noisy errors.
    disable_surveys: process.env.NODE_ENV !== "production",
    debug: process.env.NODE_ENV === "development",
  });
}
