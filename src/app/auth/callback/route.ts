import { NextResponse } from "next/server";
import { getPostHogClient } from "@/lib/posthog-server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  if (oauthError) {
    const msg = oauthErrorDescription
      ? `${oauthError}: ${oauthErrorDescription}`
      : oauthError;
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(msg)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=Could not authenticate`,
    );
  }

  const cookieStore = await cookies();
  let cookiesToSetCaptured: Array<{
    name: string;
    value: string;
    options: any;
  }> = [];

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const key =
    typeof anon === "string" && anon.startsWith("sb_secret_") ? pub : anon ?? pub;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          }));
        },
        setAll(cookiesToSet) {
          // Capture cookies so we can apply them to the final redirect response.
          cookiesToSetCaptured = cookiesToSet;
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    // Create on first sign-in (idempotent).
    await supabase.from("users").upsert(
      { id: user.id, email: user.email ?? null },
      { onConflict: "id" },
    );

    const posthog = getPostHogClient();
    if (posthog) {
      posthog.identify({
        distinctId: user.id,
        properties: {
          email: user.email ?? undefined,
          name: user.user_metadata?.full_name ?? undefined,
        },
      });
      await posthog.shutdown();
    }
  }

  let redirectUrl = `${origin}/auth/login?error=Could not authenticate`;
  if (user?.id) {
    const { data: semesters } = await supabase
      .from("semesters")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    redirectUrl =
      !semesters || semesters.length === 0
        ? `${origin}/onboarding`
        : `${origin}/dashboard`;
  }

  const response = NextResponse.redirect(redirectUrl);

  // Apply cookies captured during `exchangeCodeForSession`.
  for (const c of cookiesToSetCaptured) {
    // `c.options` is a cookie options bag produced by auth-helpers.
    response.cookies.set(c.name, c.value, c.options);
  }

  return response;
}
