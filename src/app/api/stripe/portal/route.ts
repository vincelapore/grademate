import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getSiteBaseUrl } from "@/lib/siteBaseUrl";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  const customerId =
    typeof userRow?.stripe_customer_id === "string" &&
    userRow.stripe_customer_id.trim().length > 0
      ? userRow.stripe_customer_id.trim()
      : null;
  if (!customerId) {
    return NextResponse.json(
      { error: "No Stripe customer on file for this account yet." },
      { status: 400 },
    );
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const baseUrl = (await getSiteBaseUrl()).replace(/\/$/, "");

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg =
      e instanceof Stripe.errors.StripeError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Could not create billing portal session.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

