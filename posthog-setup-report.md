<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into GradeMate. The following changes were made:

- **`instrumentation-client.ts`** (new) — Initializes `posthog-js` on the client side using the Next.js 15.3+ `instrumentation-client` convention. Captures exceptions automatically and routes events through the `/ingest` reverse proxy.
- **`next.config.ts`** — Added EU PostHog reverse proxy rewrites (`/ingest/static/*` and `/ingest/*`) and `skipTrailingSlashRedirect: true`.
- **`src/lib/posthog-server.ts`** (new) — Server-side PostHog client factory using `posthog-node`, configured with `flushAt: 1` and `flushInterval: 0` for short-lived serverless functions.
- **`.env.local`** — Added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` environment variables.
- **`src/app/auth/callback/route.ts`** — Identifies users server-side via `posthog.identify()` after OAuth callback, linking their Supabase user ID with email and display name.
- **Client components** — Event capture added to 5 client-side files (see table below).
- **`src/app/api/stripe/webhook/route.ts`** — Server-side events captured for `subscription_activated` (checkout.session.completed) and `subscription_cancelled` (customer.subscription.deleted).

## Events instrumented

| Event name | Description | File |
|---|---|---|
| `login_started` | User clicks "Continue with Google" on the login page | `src/app/auth/login/LoginClient.tsx` |
| `onboarding_university_selected` | User selects their university during onboarding step 1 | `src/components/OnboardingFlow.tsx` |
| `onboarding_semester_confirmed` | User confirms their current semester during onboarding step 2 | `src/components/OnboardingFlow.tsx` |
| `onboarding_completed` | User finishes onboarding and is redirected to the dashboard | `src/components/OnboardingFlow.tsx` |
| `course_searched` | User submits a course code search | `src/components/AddCourseSearch.tsx` |
| `course_added` | User selects a delivery mode and a course is added to their pending list | `src/components/AddCourseSearch.tsx` |
| `courses_saved` | User clicks Save courses to persist their pending courses | `src/components/AddCourseSearch.tsx` |
| `checkout_started` | User is redirected to Stripe checkout for a Pro upgrade | `src/components/ProCheckoutButton.tsx` |
| `subscription_activated` | Stripe webhook confirms a completed subscription checkout | `src/app/api/stripe/webhook/route.ts` |
| `subscription_cancelled` | Stripe webhook fires customer.subscription.deleted | `src/app/api/stripe/webhook/route.ts` |
| `account_deleted` | User confirms account deletion | `src/components/DashboardDeleteAccount.tsx` |
| `grades_exported` | User clicks Download to export grades as CSV | `src/components/DashboardSettingsActions.tsx` |
| `billing_portal_opened` | User opens the Stripe customer billing portal | `src/components/DashboardSettingsActions.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/159193/dashboard/621222
- **Onboarding funnel** (login → university → semester → complete): https://eu.posthog.com/project/159193/insights/gL7MLAna
- **Checkout to subscription conversion**: https://eu.posthog.com/project/159193/insights/wKQGkslM
- **New subscriptions vs cancellations** (daily trend): https://eu.posthog.com/project/159193/insights/CGM2PiTO
- **Daily active course additions**: https://eu.posthog.com/project/159193/insights/PwmUeIC7
- **Account deletions (churn signal)** (weekly): https://eu.posthog.com/project/159193/insights/4wfeHkDe

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
