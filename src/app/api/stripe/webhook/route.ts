import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getPostHogClient } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function subscriptionIsPro(sub: Stripe.Subscription): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function setUserProFromCheckoutSession(session: Stripe.Checkout.Session) {
  const userId =
    session.metadata?.supabase_user_id ?? session.client_reference_id;
  if (!userId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("users")
    .update({
      plan: "pro",
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  invariant(data && data.length > 0, `No user row updated for id=${userId}`);
}

async function syncSubscriptionStatus(sub: Stripe.Subscription) {
  const supabase = createServiceRoleClient();
  const metaUserId = sub.metadata?.supabase_user_id;

  if (typeof metaUserId === "string" && metaUserId.length > 0) {
    const { data, error } = await supabase
      .from("users")
      .update({
        plan: subscriptionIsPro(sub) ? "pro" : "free",
        stripe_subscription_id: sub.id,
        ...(typeof sub.customer === "string"
          ? { stripe_customer_id: sub.customer }
          : {}),
      })
      .eq("id", metaUserId)
      .select("id");
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
    invariant(
      data && data.length > 0,
      `No user row updated for id=${metaUserId}`,
    );
    return;
  }

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const { data, error } = await supabase
    .from("users")
    .update({
      plan: subscriptionIsPro(sub) ? "pro" : "free",
      stripe_subscription_id: sub.id,
    })
    .eq("stripe_customer_id", customerId)
    .select("id");
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  invariant(
    data && data.length > 0,
    `No user row updated for stripe_customer_id=${customerId}`,
  );
}

async function clearPlanForSubscription(sub: Stripe.Subscription) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("users")
    .update({ plan: "free", stripe_subscription_id: null })
    .eq("stripe_subscription_id", sub.id)
    .select("id");
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  invariant(
    data && data.length > 0,
    `No user row updated for stripe_subscription_id=${sub.id}`,
  );
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await setUserProFromCheckoutSession(session);
          const userId =
            session.metadata?.supabase_user_id ?? session.client_reference_id;
          if (userId) {
            const posthog = getPostHogClient();
            if (posthog) {
              posthog.capture({
                distinctId: userId,
                event: "subscription_activated",
                properties: {
                  stripe_session_id: session.id,
                  amount_total: session.amount_total,
                  currency: session.currency,
                },
              });
              await posthog.shutdown();
            }
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionStatus(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await clearPlanForSubscription(sub);
        const metaUserId = sub.metadata?.supabase_user_id;
        if (metaUserId) {
          const posthog = getPostHogClient();
          if (posthog) {
            posthog.capture({
              distinctId: metaUserId,
              event: "subscription_cancelled",
              properties: {
                stripe_subscription_id: sub.id,
                cancel_at_period_end: sub.cancel_at_period_end,
              },
            });
            await posthog.shutdown();
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook handler failed";
    console.error("[stripe-webhook] handler error", {
      eventType: event.type,
      eventId: event.id,
      message: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
