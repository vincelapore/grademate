import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Apply the same DB updates as `checkout.session.completed` webhook, after verifying
 * the Checkout Session belongs to this user. Use when webhooks cannot reach the server
 * (e.g. local dev without Stripe CLI forwarding).
 */
export async function syncProFromStripeCheckoutSession(
  userId: string,
  checkoutSessionId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!checkoutSessionId.startsWith("cs_")) {
    return { ok: false, reason: "invalid_session_id" };
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return { ok: false, reason: "stripe_not_configured" };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  } catch (e) {
    console.error("[syncCheckoutSession] retrieve failed", e);
    return { ok: false, reason: "retrieve_failed" };
  }

  const uid =
    session.metadata?.supabase_user_id ?? session.client_reference_id ?? null;
  if (uid !== userId) {
    return { ok: false, reason: "user_mismatch" };
  }

  if (session.mode !== "subscription") {
    return { ok: false, reason: "not_subscription" };
  }

  if (session.status !== "complete") {
    return { ok: false, reason: "session_not_complete" };
  }

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

  if (error) {
    console.error("[syncCheckoutSession] supabase update failed", error);
    return { ok: false, reason: "db_error" };
  }
  if (!data?.length) {
    return { ok: false, reason: "no_user_row" };
  }

  return { ok: true };
}
