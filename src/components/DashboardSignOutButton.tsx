"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DashboardSignOutButton({
  className,
}: {
  className?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => void signOut()}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
