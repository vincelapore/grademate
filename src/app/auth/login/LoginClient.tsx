"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GmShell } from "@/components/gm/GmShell";
import posthog from "posthog-js";

function LoginContent() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const supabase = createClient();

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    posthog.capture("login_started", { provider: "google" });

    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  const urlError = searchParams.get("error");

  return (
    <GmShell variant="app" showFooter={false}>
      <main className="gm-container" style={{ maxWidth: 520 }}>
        <div className="gm-card">
          <div style={{ marginBottom: 14 }}>
            <h1 style={{ fontFamily: "var(--font-gm-serif)", fontSize: 24 }}>
              Sign in
            </h1>
            <p style={{ marginTop: 6, color: "var(--color-text-secondary)" }}>
              Continue with Google to access your courses and GPA.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="gm-btn-primary"
            style={{ width: "100" + "%", justifyContent: "center" }}
          >
            Continue with Google
          </button>

          {(urlError || error) && (
            <div
              style={{
                marginTop: 12,
                border: "0.5px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.08)",
                padding: "10px 12px",
                borderRadius: 12,
                color: "#ef4444",
                fontSize: 13,
              }}
            >
              {urlError ?? error}
            </div>
          )}

          <p
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "var(--color-text-tertiary)",
            }}
          >
            By continuing, you&apos;ll sign in with your Google account.
          </p>

          <p
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "var(--color-text-tertiary)",
            }}
          >
            Back to{" "}
            <Link href="/" className="gm-nav-link">
              home
            </Link>
            .
          </p>
        </div>
      </main>
    </GmShell>
  );
}

export default function LoginClient() {
  return (
    <Suspense
      fallback={
        <GmShell variant="app" showFooter={false}>
          <main className="gm-container" style={{ maxWidth: 520 }}>
            <div className="gm-card">
              <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>
            </div>
          </main>
        </GmShell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

