import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (typeof window !== "undefined" && token && token.trim()) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    // Heatmaps (often on via remote config) always spin up dead-clicks with a separate
    // "enabled" check that ignores capture_dead_clicks — so disable heatmaps in dev too,
    // otherwise the dead-clicks script still loads and fails noisily.
    ...(process.env.NODE_ENV !== "production"
      ? { capture_dead_clicks: false, capture_heatmaps: false }
      : {}),
    // Web vitals loads an extra script; in dev it’s commonly blocked and noisy.
    capture_performance: process.env.NODE_ENV === "production",
    // Exception Autocapture loads an extra script; in dev it’s commonly blocked
    // (adblock/CSP/local rewrites) and triggers noisy console errors.
    capture_exceptions: process.env.NODE_ENV === "production",
    // Surveys also load an extra script; disable in dev to avoid noisy errors.
    disable_surveys: process.env.NODE_ENV !== "production",
    // Session replay loads the recorder bundle; in dev it often fails to load and logs errors.
    disable_session_recording: process.env.NODE_ENV !== "production",
    debug: process.env.NODE_ENV === "development",
  });
}
