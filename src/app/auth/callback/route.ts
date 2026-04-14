import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/dashboard";

  if (oauthError) {
    const msg = oauthErrorDescription
      ? `${oauthError}: ${oauthErrorDescription}`
      : oauthError;
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(msg)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        // Create on first sign-in (idempotent).
        await supabase
          .from("users")
          .upsert(
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

      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate`);
}
