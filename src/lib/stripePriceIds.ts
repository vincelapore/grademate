export type ProPriceTier = "founding_annual" | "annual" | "monthly";

const ENV_KEYS: Record<ProPriceTier, string> = {
  founding_annual: "STRIPE_PRICE_FOUNDING_ANNUAL",
  annual: "STRIPE_PRICE_ANNUAL",
  monthly: "STRIPE_PRICE_MONTHLY",
};

export function envKeyForTier(tier: ProPriceTier): string {
  return ENV_KEYS[tier];
}

export function priceIdForTier(tier: ProPriceTier): string | null {
  const envName = ENV_KEYS[tier];
  const id = process.env[envName];
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
}

export function isStripeBillingConfigured(): boolean {
  return (
    priceIdForTier("founding_annual") != null &&
    priceIdForTier("annual") != null &&
    priceIdForTier("monthly") != null
  );
}
