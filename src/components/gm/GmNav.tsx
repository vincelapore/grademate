"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GmLogo } from "./GmLogo";

export type GmNavVariant = "marketing" | "app";

export function GmNav({
  variant,
}: {
  variant: GmNavVariant;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setIsLoggedIn(Boolean(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <nav className="gm-nav">
      <GmLogo />
      <div className="gm-nav-links">
        {variant === "marketing" ? (
          <>
            <a className="gm-nav-link" href="#how-it-works">
              How it works
            </a>
            {/* <a className="gm-nav-link" href="#pricing">
              Pricing
            </a> */}
            <Link className="gm-nav-cta" href={isLoggedIn ? "/dashboard" : "/auth/login"}>
              {isLoggedIn ? "Dashboard" : "Get started free"}
            </Link>
          </>
        ) : (
          <>
            <Link className="gm-nav-cta" href={isLoggedIn ? "/dashboard" : "/auth/login"}>
              {isLoggedIn ? "Dashboard" : "Sign in"}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

