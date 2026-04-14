import Link from "next/link";

export const dynamic = "force-static";

export default function TermsPage() {
  return (
    <main className="gm-container" style={{ padding: "34px 0" }}>
      <Link href="/" className="gm-dash-settings-back">
        ← Home
      </Link>
      <h1
        style={{
          margin: "14px 0 8px",
          fontSize: "1.9rem",
          fontWeight: 650,
          letterSpacing: "-0.03em",
          color: "var(--color-text-primary)",
        }}
      >
        Terms
      </h1>
      <p style={{ margin: 0, color: "var(--color-text-tertiary)" }}>
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <div
        className="gm-dash-card"
        style={{ marginTop: 16, lineHeight: 1.6, color: "var(--color-text-secondary)" }}
      >
        <p style={{ marginTop: 0 }}>
          Grademate is provided “as is” without warranties. You are responsible
          for verifying any grade calculations and decisions made using the app.
        </p>
        <p>
          You agree not to misuse the service (including attempting to access
          other users’ data or disrupting the service).
        </p>
        <p style={{ marginBottom: 0 }}>
          For questions, contact{" "}
          <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
        </p>
      </div>
    </main>
  );
}

