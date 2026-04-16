"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  loggedOutHref: string;
  loggedOutLabel: string;
  loggedInHref?: string;
  loggedInLabel?: string;
  className?: string;
};

export function AuthAwareCta({
  loggedOutHref,
  loggedOutLabel,
  loggedInHref = "/dashboard",
  loggedInLabel = "Dashboard",
  className,
}: Props) {
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
    <Link
      href={isLoggedIn ? loggedInHref : loggedOutHref}
      className={className}
    >
      {isLoggedIn ? loggedInLabel : loggedOutLabel}
    </Link>
  );
}
