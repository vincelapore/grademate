import Link from "next/link";

export const dynamic = "force-static";

export default function PrivacyPage() {
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
        Privacy Policy
      </h1>
      <p style={{ margin: 0, color: "var(--color-text-tertiary)" }}>
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <div
        className="gm-dash-card"
        style={{ marginTop: 16, lineHeight: 1.6, color: "var(--color-text-secondary)" }}
      >
        <p style={{ marginTop: 0 }}>
          We collect the information you choose to enter (semesters, courses, and
          marks) to provide the Grademate service. If you create an account, we
          also store your authentication identifier and email (if provided).
        </p>
        <p>
          We use third-party providers to operate the service (for example,
          hosting and billing). If you subscribe, payments are processed by Stripe;
          we do not store your card details.
        </p>
        <p style={{ marginBottom: 0 }}>
          Questions? Email{" "}
          <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
        </p>
      </div>
    </main>
  );
}

