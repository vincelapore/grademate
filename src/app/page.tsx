import { GmButtonAnchor, GmButtonLink } from "@/components/gm/GmButton";
import { GmShell } from "@/components/gm/GmShell";
import { LandingGoogleButton } from "@/components/LandingGoogleButton";

export default function Home() {
  return (
    <GmShell variant="marketing">
      <div className="gm-hero">
        <div className="gm-badge">
          <div className="gm-badge-dot" />
          Now supporting UQ — UniMelb coming soon
        </div>
        <h1 className="gm-h1">
          Finally know
          <br />
          <em>where you stand.</em>
        </h1>
        <p className="gm-sub">
          Track your grades, assessments, and GPA — with your university&apos;s
          courses already loaded. No spreadsheets. No guessing.
        </p>
        <div className="gm-cta-row">
          <LandingGoogleButton />
          <GmButtonAnchor variant="ghost" href="#how-it-works">
            See how it works
          </GmButtonAnchor>
        </div>
        <p className="gm-unis">
          Currently supporting UQ · QUT coming soon · UniMelb coming soon
        </p>
      </div>

      <div className="gm-dashboard">
        <div className="gm-dash-header">
          <span className="gm-dash-title">
            Semester 1, 2026 — Bachelor of Computer Science
          </span>
          <span className="gm-gpa-pill">GPA 5.8</span>
        </div>
        <div className="gm-stats">
          <div className="gm-stat">
            <div className="gm-stat-label">Courses</div>
            <div className="gm-stat-value">4</div>
          </div>
          <div className="gm-stat">
            <div className="gm-stat-label">Assessments due</div>
            <div className="gm-stat-value amber">3</div>
          </div>
          <div className="gm-stat">
            <div className="gm-stat-label">Degree progress</div>
            <div className="gm-stat-value green">43%</div>
          </div>
        </div>
        <div className="gm-courses">
          <div className="gm-course">
            <div>
              <div className="gm-course-code">COMP3400</div>
              <div className="gm-course-name">Functional Programming</div>
            </div>
            <div className="gm-course-bar-wrap">
              <div className="gm-bar">
                <div className="gm-bar-fill green" style={{ width: "72%" }} />
              </div>
              <span className="gm-course-need">need 61% on final</span>
            </div>
            <div className="gm-course-grade" style={{ color: "#1D9E75" }}>
              72%
            </div>
          </div>
          <div className="gm-course">
            <div>
              <div className="gm-course-code">CSSE3100</div>
              <div className="gm-course-name">Reasoning About Programs</div>
            </div>
            <div className="gm-course-bar-wrap">
              <div className="gm-bar">
                <div className="gm-bar-fill amber" style={{ width: "58%" }} />
              </div>
              <span className="gm-course-need">need 74% on final</span>
            </div>
            <div className="gm-course-grade" style={{ color: "#BA7517" }}>
              58%
            </div>
          </div>
          <div className="gm-course">
            <div>
              <div className="gm-course-code">DRAM2030</div>
              <div className="gm-course-name">Theatre History &amp; Practice</div>
            </div>
            <div className="gm-course-bar-wrap">
              <div className="gm-bar">
                <div className="gm-bar-fill blue" style={{ width: "85%" }} />
              </div>
              <span className="gm-course-need">on track</span>
            </div>
            <div className="gm-course-grade" style={{ color: "#378ADD" }}>
              85%
            </div>
          </div>
        </div>
      </div>

      <hr className="gm-divider" />

      <div className="gm-features" id="how-it-works">
        <div className="gm-feat-label">What it does</div>
        <h2 className="gm-feat-heading">
          Everything in one place,
          <br />
          nothing to set up.
        </h2>
        <div className="gm-feat-grid">
          <div className="gm-feat-card">
            <div className="gm-feat-icon">
              <svg viewBox="0 0 16 16" fill="none">
                <rect x={2} y={2} width={5} height={5} rx={1} fill="#1D9E75" />
                <rect x={9} y={2} width={5} height={5} rx={1} fill="#9FE1CB" />
                <rect x={2} y={9} width={5} height={5} rx={1} fill="#9FE1CB" />
                <rect x={9} y={9} width={5} height={5} rx={1} fill="#5DCAA5" />
              </svg>
            </div>
            <div className="gm-feat-title">Courses auto-loaded</div>
            <div className="gm-feat-desc">
              Pick your course code and every assessment, weighting, and due date
              appears instantly.
            </div>
          </div>
          <div className="gm-feat-card">
            <div className="gm-feat-icon">
              <svg viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 12 L8 4 L13 9"
                  stroke="#1D9E75"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={13} cy={9} r={2} fill="#1D9E75" />
              </svg>
            </div>
            <div className="gm-feat-title">Know what you need</div>
            <div className="gm-feat-desc">
              See exactly what score you need on each remaining assessment to hit
              your target grade.
            </div>
          </div>
          <div className="gm-feat-card">
            <div className="gm-feat-icon">
              <svg viewBox="0 0 16 16" fill="none">
                <circle
                  cx={8}
                  cy={8}
                  r="5.5"
                  stroke="#1D9E75"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 5v3l2 2"
                  stroke="#1D9E75"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="gm-feat-title">Track your GPA</div>
            <div className="gm-feat-desc">
              Your GPA updates in real time as you enter grades. See your semester
              and cumulative average at a glance.
            </div>
          </div>
          <div className="gm-feat-card">
            <div className="gm-feat-icon">
              <svg viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 13h12M4 13V8m4 5V5m4 8V9"
                  stroke="#1D9E75"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="gm-feat-title">Degree progress</div>
            <div className="gm-feat-desc">
              See how far through your degree you are, and whether you&apos;re on
              track for honours or grad programs.
            </div>
          </div>
        </div>
      </div>

      <hr className="gm-divider" />

      <div className="gm-pricing" id="pricing">
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div className="gm-feat-label" style={{ textAlign: "center" }}>
            Pricing
          </div>
          <h2 className="gm-feat-heading" style={{ margin: 0 }}>
            Simple. No gotchas.
          </h2>
        </div>
        <div className="gm-price-grid">
          <div className="gm-price-card">
            <div className="gm-price-tier">Free</div>
            <div className="gm-price-amount">$0</div>
            <div className="gm-price-cadence">forever</div>
            <ul className="gm-price-features">
              <li>
                <span className="gm-check">✓</span> Current semester
              </li>
              <li>
                <span className="gm-check">✓</span> Up to 4 courses
              </li>
              <li>
                <span className="gm-check">✓</span> Grade calculator
              </li>
              <li>
                <span className="gm-check">✓</span> Assessment due dates
              </li>
            </ul>
            <GmButtonLink className="gm-price-btn" href="/auth/login">
              Get started
            </GmButtonLink>
          </div>
          <div className="gm-price-card featured">
            <div className="gm-price-tier" style={{ color: "#1D9E75" }}>
              Pro
            </div>
            <div className="gm-price-amount">$39</div>
            <div className="gm-price-cadence">per year · or $4.99/mo</div>
            <ul className="gm-price-features">
              <li>
                <span className="gm-check">✓</span> Everything in Free
              </li>
              <li>
                <span className="gm-check">✓</span> Unlimited semesters
              </li>
              <li>
                <span className="gm-check">✓</span> Degree progress tracking
              </li>
              <li>
                <span className="gm-check">✓</span> GPA history
              </li>
              <li>
                <span className="gm-check">✓</span> What-if scenarios
              </li>
            </ul>
            <GmButtonLink className="gm-price-btn featured" href="/auth/login">
              Get Pro
            </GmButtonLink>
          </div>
        </div>
      </div>
    </GmShell>
  );
}
