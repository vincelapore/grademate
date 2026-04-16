import Link from "next/link";
import { GmShell } from "@/components/gm/GmShell";

export const dynamic = "force-static";

export default function PrivacyPage() {
  return (
    <GmShell variant="marketing">
      <main className="gm-legal">
        <div className="gm-legal-top">
          <Link href="/" className="gm-dash-settings-back">
            ← Home
          </Link>
          <div className="gm-legal-eyebrow">Grademate · grademate.dev</div>
          <h1 className="gm-legal-title">Privacy Policy</h1>
          <p className="gm-legal-sub">Last updated: April 2026</p>
        </div>

        <section className="gm-legal-card gm-legal-body">
          <h2>Who we are</h2>
          <p>
            Grademate is a student grade tracking tool available at grademate.dev.
            If you have any questions about this policy, email us at{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
          </p>

          <hr className="gm-legal-divider" />

          <h2>What information we collect</h2>
          <p>
            <strong>Information you give us directly</strong>
          </p>
          <ul>
            <li>Your name and email address when you sign in with Google</li>
            <li>Your university, degree, and academic details you enter</li>
            <li>
              Course codes, assessment names, weightings, due dates, and grades you
              enter or that are auto-populated from your university&apos;s course
              profiles
            </li>
            <li>
              Your payment details — we never see or store your card number.
              Payments are processed by Stripe. We only receive confirmation that
              payment was made.
            </li>
          </ul>

          <p>
            <strong>Information collected automatically</strong>
          </p>
          <ul>
            <li>
              Basic usage data — which pages you visit, when you log in, how you
              use the app
            </li>
            <li>Your IP address and browser type</li>
            <li>
              Cookies and similar technologies to keep you logged in and remember
              your preferences
            </li>
          </ul>

          <p>
            <strong>Information from third parties</strong>
          </p>
          <ul>
            <li>
              Google provides your name, email address, and profile picture when
              you sign in with Google OAuth
            </li>
            <li>Stripe provides confirmation of payment and subscription status</li>
          </ul>

          <hr className="gm-legal-divider" />

          <h2>How we use your information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and operate the Grademate service</li>
            <li>Calculate your grades and WAM</li>
            <li>
              Pre-populate course assessments from university course profiles via
              our scraper
            </li>
            <li>Process payments and manage your subscription via Stripe</li>
            <li>Send you transactional emails (payment confirmations, account notices)</li>
            <li>Improve the product based on how it&apos;s used</li>
            <li>Respond to your support requests</li>
          </ul>
          <p>
            We do not sell your data. We do not use your data for advertising. We
            do not share your academic data with your university, employers, or
            any third party.
          </p>

          <hr className="gm-legal-divider" />

          <h2>How we store your data</h2>
          <p>
            Your data is stored in Supabase, a cloud database service with servers
            located in the United States (AWS). Supabase is SOC 2 compliant.
          </p>
          <p>
            Payment processing is handled by Stripe. We do not store payment card
            details.
          </p>
          <p>
            We take reasonable security measures including row-level security on
            all database tables, meaning your data is only accessible to you.
          </p>

          <hr className="gm-legal-divider" />

          <h2>How long we keep your data</h2>
          <p>
            We keep your data for as long as you have an account with Grademate.
            If you delete your account, we delete all your data from our database
            within 30 days. Some anonymised, aggregated usage data may be retained
            for product improvement purposes.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Your rights</h2>
          <p>
            Under Australian Privacy Law and, where applicable, GDPR, you have the
            right to:
          </p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>
              Request deletion of your data (you can do this directly from Settings
              → Delete account)
            </li>
            <li>Export your data</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>
            To exercise any of these rights, email{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Cookies</h2>
          <p>We use cookies to:</p>
          <ul>
            <li>Keep you logged in (authentication cookies via Supabase)</li>
            <li>Remember your theme preference (light/dark mode)</li>
          </ul>
          <p>
            We do not use advertising cookies or third-party tracking cookies. You
            can disable cookies in your browser settings, though this will prevent
            you from staying logged in.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Third-party services</h2>
          <p>Grademate uses the following third-party services:</p>
          <div className="gm-legal-table-wrap">
            <table className="gm-legal-table">
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Privacy Policy</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Supabase</td>
                  <td>Database and authentication</td>
                  <td>
                    <a
                      href="https://supabase.com/privacy"
                      target="_blank"
                      rel="noreferrer"
                    >
                      supabase.com/privacy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Stripe</td>
                  <td>Payment processing</td>
                  <td>
                    <a
                      href="https://stripe.com/privacy"
                      target="_blank"
                      rel="noreferrer"
                    >
                      stripe.com/privacy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Google OAuth</td>
                  <td>Sign in</td>
                  <td>
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noreferrer"
                    >
                      policies.google.com/privacy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>Vercel</td>
                  <td>Hosting</td>
                  <td>
                    <a
                      href="https://vercel.com/legal/privacy-policy"
                      target="_blank"
                      rel="noreferrer"
                    >
                      vercel.com/legal/privacy-policy
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <hr className="gm-legal-divider" />

          <h2>University course data</h2>
          <p>
            We scrape publicly available course profile information from university
            websites (assessment names, weightings, and due dates) to pre-populate
            your dashboard. This data is publicly accessible and we do not claim
            ownership of it. It is used solely to improve your experience in
            Grademate.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Children&apos;s privacy</h2>
          <p>
            Grademate is not intended for children under 13. We do not knowingly
            collect data from children under 13. If you believe a child under 13
            has provided us with personal information, please contact us at{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a> and we
            will delete it.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Changes to this policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you
            of significant changes by email or by displaying a notice in the app.
            The date at the top of this page reflects when the policy was last
            updated.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Contact</h2>
          <p>
            For any privacy-related questions, contact us at{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
          </p>
        </section>
      </main>
    </GmShell>
  );
}

