"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LandingGoogleButton() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function onClick() {
    setLoading(true);
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`,
      },
    });
  }

  return (
    <button
      type="button"
      className="gm-btn-primary"
      onClick={onClick}
      disabled={loading}
    >
      Continue with Google →
    </button>
  );
}

