import { PostHog } from "posthog-node";

export function getPostHogClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || !token.trim()) return null;

  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}
