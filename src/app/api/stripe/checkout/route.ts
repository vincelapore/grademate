import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getSiteBaseUrl } from "@/lib/siteBaseUrl";
import { getStripe } from "@/lib/stripe";
import { priceIdForTier } from "@/lib/stripePriceIds";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("plan, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle<{ plan: string | null; stripe_customer_id: string | null }>();

  if (userRow?.plan === "pro") {
    return NextResponse.json(
      { error: "You already have Pro." },
      { status: 400 },
    );
  }

  // Single-plan billing: always use the annual price.
  const priceId = priceIdForTier("annual");
  if (!priceId) {
    return NextResponse.json(
      {
        error:
          "Stripe price not configured: set STRIPE_PRICE_ANNUAL in .env.local (Stripe Dashboard → Products → Price → API ID price_…).",
      },
      { status: 503 },
    );
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Missing STRIPE_SECRET_KEY in .env.local (use your Stripe secret key, e.g. sk_test_…).",
      },
      { status: 503 },
    );
  }

  const baseUrl = (await getSiteBaseUrl()).replace(/\/$/, "");

  const customerId =
    typeof userRow?.stripe_customer_id === "string" &&
    userRow.stripe_customer_id.trim().length > 0
      ? userRow.stripe_customer_id.trim()
      : undefined;

  const email =
    user.email ??
    (typeof user.user_metadata?.email === "string"
      ? user.user_metadata.email
      : undefined);

  if (!customerId && !email?.trim()) {
    return NextResponse.json(
      {
        error:
          "Your account has no email on file. Sign in with a provider that supplies an email, or add one in Supabase Auth, then try again.",
      },
      { status: 400 },
    );
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/settings?checkout=cancelled`,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    ...(customerId
      ? { customer: customerId }
      : { customer_email: email!.trim() }),
    allow_promotion_codes: true,
  };

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeError &&
      err.code === "resource_missing" &&
      sessionParams.customer
    ) {
      try {
        const { customer: _removed, ...withoutCustomer } = sessionParams;
        void _removed;
        session = await stripe.checkout.sessions.create({
          ...withoutCustomer,
          ...(email?.trim()
            ? { customer_email: email.trim() }
            : {}),
        });
      } catch (err2) {
        const msg =
          err2 instanceof Stripe.errors.StripeError
            ? err2.message
            : err2 instanceof Error
              ? err2.message
              : String(err2);
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    } else {
      const msg =
        err instanceof Stripe.errors.StripeError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL. Check price IDs and Stripe dashboard mode (test vs live)." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
