export type ProPriceTier = "annual";

const ENV_KEYS: Record<ProPriceTier, string> = {
  annual: "STRIPE_PRICE_ANNUAL",
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
  return priceIdForTier("annual") != null;
}
