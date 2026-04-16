import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  // Guardrail: never allow secret keys in the browser.
  const key =
    typeof anon === "string" && anon.startsWith("sb_secret_") ? pub : anon ?? pub
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!
  )
}
