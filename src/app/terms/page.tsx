import Link from "next/link";
import { GmShell } from "@/components/gm/GmShell";

export const dynamic = "force-static";

export default function TermsPage() {
  return (
    <GmShell variant="marketing">
      <main className="gm-legal">
        <div className="gm-legal-top">
          <Link href="/" className="gm-dash-settings-back">
            ← Home
          </Link>
          <div className="gm-legal-eyebrow">Grademate · grademate.dev</div>
          <h1 className="gm-legal-title">Terms of Service</h1>
          <p className="gm-legal-sub">Last updated: April 2026</p>
        </div>

        <section className="gm-legal-card gm-legal-body">
          <h2>Who we are</h2>
          <p>
            Grademate is a student grade tracking tool available at grademate.dev.
            By using Grademate, you agree to these terms. If you don&apos;t agree,
            please don&apos;t use the service.
          </p>
          <p>
            Questions? Email{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
          </p>

          <hr className="gm-legal-divider" />

          <h2>What Grademate is</h2>
          <p>
            Grademate is a grade tracking tool that helps students calculate their
            grades, WAM, and understand what scores they need on upcoming
            assessments. It is a personal productivity tool, not an official
            academic record system.
          </p>
          <p>
            Grademate is not affiliated with any university. Grade calculations
            are for personal planning purposes only. Your official grades are
            determined by your university, not by Grademate. Always verify your
            grades with your institution&apos;s official systems.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Your account</h2>
          <p>
            You need to create an account to use Grademate. You can sign in with
            Google.
          </p>
          <p>You are responsible for:</p>
          <ul>
            <li>Keeping your account secure</li>
            <li>All activity that occurs under your account</li>
            <li>The accuracy of the information you enter</li>
          </ul>
          <p>
            You must be at least 13 years old to use Grademate. By creating an
            account, you confirm you meet this requirement.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Free and Pro plans</h2>
          <p>
            <strong>Free plan</strong>
          </p>
          <p>
            The free plan allows you to track up to 3 courses per semester. You can
            create an account, store your grades, and use all core features within
            that limit.
          </p>
          <p>
            <strong>Pro plan</strong>
          </p>
          <p>
            The Pro plan is available at $19/year (Founding rate, locked for the
            life of your account) or $29/year (Standard rate). Pro unlocks
            unlimited courses, in-product course auto-population via our
            university scraper, and multi-semester history.
          </p>
          <p>
            The Founding rate of $19/year is locked permanently for users who
            subscribe at that price. Grademate will not increase this rate for
            Founding subscribers.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Payments and billing</h2>
          <p>
            Payments are processed by Stripe. By subscribing to Pro, you authorise
            Stripe to charge your payment method on an annual basis until you
            cancel.
          </p>
          <p>
            <strong>Cancellation</strong>
          </p>
          <p>
            You can cancel your subscription at any time from Settings → Manage
            billing. Cancellation takes effect at the end of your current billing
            period. We do not offer refunds for partial billing periods.
          </p>
          <p>
            <strong>Refunds</strong>
          </p>
          <p>
            If you experience a technical issue that prevents you from using
            Grademate and we are unable to resolve it within 7 days, we will
            provide a full refund for your most recent payment. For all other
            refund requests, contact{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a> and we
            will consider them on a case-by-case basis.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use Grademate for any unlawful purpose</li>
            <li>Attempt to access other users&apos; data</li>
            <li>Reverse engineer, scrape, or copy the Grademate application or codebase</li>
            <li>Attempt to bypass or circumvent the course limit or any other feature gate</li>
            <li>Use automated tools to access Grademate in a way that places excessive load on our servers</li>
            <li>Impersonate another person or entity</li>
          </ul>

          <hr className="gm-legal-divider" />

          <h2>University course data</h2>
          <p>
            Grademate scrapes publicly available course profile information from
            university websites to pre-populate assessment data. This information
            is publicly accessible. We do not claim ownership of university course
            data. If you represent a university and have concerns about our use of
            our public course profile data, contact{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Accuracy of grade calculations</h2>
          <p>
            Grademate performs grade calculations based on information you enter
            and from scraped course profiles. We take reasonable care to ensure
            calculations are correct, but:
          </p>
          <ul>
            <li>We do not guarantee the accuracy of any calculation</li>
            <li>Scraped assessment data may be outdated or incorrect</li>
            <li>Your university&apos;s official grading system may differ from how we have implemented it</li>
            <li>Always verify your grades and academic standing with your university directly</li>
          </ul>
          <p>
            Grademate is a planning tool, not an authoritative academic record. Do
            not make academic or financial decisions based solely on Grademate
            calculations.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Intellectual property</h2>
          <p>
            Grademate and all content, design, code, and features are owned by
            Grademate. You may not copy, reproduce, or distribute any part of
            Grademate without our written permission.
          </p>
          <p>
            Your data — the grades, courses, and assessments you enter — belongs
            to you. We do not claim ownership of your personal academic data.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Data and privacy</h2>
          <p>
            Our Privacy Policy explains how we collect, use, and store your data.
            By using Grademate, you agree to our Privacy Policy.
          </p>
          <p>If you delete your account, we will delete your data within 30 days.</p>

          <hr className="gm-legal-divider" />

          <h2>Availability</h2>
          <p>
            We aim to keep Grademate available at all times but we cannot
            guarantee uninterrupted access. We may need to take the service down
            for maintenance or updates. We will try to give notice when possible.
          </p>
          <p>Grademate is not liable for any loss or inconvenience caused by downtime.</p>

          <hr className="gm-legal-divider" />

          <h2>Limitation of liability</h2>
          <p>To the maximum extent permitted by Australian law:</p>
          <ul>
            <li>Grademate is provided &quot;as is&quot; without warranties of any kind</li>
            <li>
              Grademate is not liable for any indirect, incidental, or consequential
              damages arising from your use of the service
            </li>
            <li>
              Our total liability to you for any claim is limited to the amount you
              paid us in the 12 months prior to the claim
            </li>
          </ul>
          <p>Nothing in these terms limits your rights under Australian Consumer Law.</p>

          <hr className="gm-legal-divider" />

          <h2>Australian Consumer Law</h2>
          <p>
            Nothing in these terms excludes, restricts, or modifies any rights you
            have under the Australian Consumer Law. If you are a consumer, you may
            have statutory guarantees that cannot be excluded.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Changes to these terms</h2>
          <p>
            We may update these terms from time to time. We will notify you of
            material changes by email or by displaying a notice in the app at least
            14 days before they take effect. Continued use of Grademate after
            changes take effect constitutes acceptance of the new terms.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of Queensland, Australia. Any
            disputes will be resolved in the courts of Queensland, Australia.
          </p>

          <hr className="gm-legal-divider" />

          <h2>Contact</h2>
          <p>
            For any questions about these terms, email{" "}
            <a href="mailto:hello@grademate.dev">hello@grademate.dev</a>.
          </p>
        </section>
      </main>
    </GmShell>
  );
}

