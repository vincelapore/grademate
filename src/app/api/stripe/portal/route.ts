import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getSiteBaseUrl } from "@/lib/siteBaseUrl";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service";

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
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle<{
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    }>();

  let customerId =
    typeof userRow?.stripe_customer_id === "string" &&
    userRow.stripe_customer_id.trim().length > 0
      ? userRow.stripe_customer_id.trim()
      : null;

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // Pro users who completed checkout before we stored customer id: recover from subscription.
  if (
    !customerId &&
    typeof userRow?.stripe_subscription_id === "string" &&
    userRow.stripe_subscription_id.trim().startsWith("sub_")
  ) {
    try {
      const sub = await stripe.subscriptions.retrieve(
        userRow.stripe_subscription_id.trim(),
      );
      const cid =
        typeof sub.customer === "string"
          ? sub.customer
          : sub.customer && "id" in sub.customer
            ? sub.customer.id
            : null;
      if (cid) {
        try {
          const svc = createServiceRoleClient();
          await svc
            .from("users")
            .update({ stripe_customer_id: cid })
            .eq("id", user.id);
        } catch (svcErr) {
          console.error("[stripe/portal] service role update failed", svcErr);
          return NextResponse.json(
            {
              error:
                "Could not save billing link. Check SUPABASE_SERVICE_ROLE_KEY on the server.",
            },
            { status: 503 },
          );
        }
        customerId = cid;
      } else {
        return NextResponse.json(
          {
            error:
              "Could not resolve a Stripe customer from your subscription. Contact support.",
          },
          { status: 400 },
        );
      }
    } catch (e) {
      const msg =
        e instanceof Stripe.errors.StripeError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not look up subscription.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No Stripe customer on file yet. Complete Pro checkout once, or contact support if you already paid.",
      },
      { status: 400 },
    );
  }

  const baseUrl = (await getSiteBaseUrl()).replace(/\/$/, "");
  const portalConfiguration =
    typeof process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID === "string" &&
    process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID.trim().startsWith("bpc_")
      ? process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID.trim()
      : undefined;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/settings?billing=return`,
      ...(portalConfiguration ? { configuration: portalConfiguration } : {}),
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

