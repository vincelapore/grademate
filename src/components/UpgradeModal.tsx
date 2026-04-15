"use client";

import { ProCheckoutButton } from "@/components/ProCheckoutButton";

export function UpgradeModal({
  onClose,
  reason = "courses",
  semesterCount,
  courseCount,
}: {
  onClose: () => void;
  reason?: "courses" | "semesters" | "overall" | "generic";
  semesterCount?: number;
  courseCount?: number;
}) {
  const title =
    reason === "semesters" || reason === "overall"
      ? `You’re tracking ${typeof semesterCount === "number" ? semesterCount : 1} semester${typeof semesterCount === "number" && semesterCount === 1 ? "" : "s"}`
      : reason === "generic"
        ? "Upgrade to Grademate Pro"
        : `You’re tracking ${typeof courseCount === "number" ? courseCount : 3} course${typeof courseCount === "number" && courseCount === 1 ? "" : "s"}`;

  const sub =
    reason === "semesters" || reason === "overall"
      ? "Free includes 1 semester. Upgrade to add more semesters and unlock overall view."
      : reason === "generic"
        ? "Unlock multiple semesters, overall view, and more than four courses per semester."
        : "Most students take 4. Upgrade to add more — and unlock the good stuff.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Grademate Pro"
      className="gm-paywall-overlay"
      onClick={onClose}
    >
      <div className="gm-paywall-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="gm-paywall-handle" aria-hidden />
        <div className="gm-paywall-eyebrow">Grademate Pro</div>
        <h2 className="gm-paywall-title">{title}</h2>
        <p className="gm-paywall-sub">{sub}</p>

        <div className="gm-paywall-feature">
          <div className="gm-paywall-feat-icon" aria-hidden>
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2L9.5 6.5H14L10.5 9L12 13.5L8 11L4 13.5L5.5 9L2 6.5H6.5L8 2Z"
                fill="#0F6E56"
              />
            </svg>
          </div>
          <div>
            <div className="gm-paywall-feat-name">Auto-import from your uni</div>
            <div className="gm-paywall-feat-desc">
              Assessments, weights &amp; due dates load instantly for UQ, Monash,
              UniMelb and more
            </div>
          </div>
        </div>

        <div className="gm-paywall-feature">
          <div className="gm-paywall-feat-icon" aria-hidden>
            <svg viewBox="0 0 16 16" fill="none">
              <rect
                x="2"
                y="3"
                width="12"
                height="10"
                rx="2"
                stroke="#0F6E56"
                strokeWidth="1.5"
              />
              <path
                d="M5 7h6M5 9.5h4"
                stroke="#0F6E56"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div className="gm-paywall-feat-name">
              Unlimited courses &amp; semesters
            </div>
            <div className="gm-paywall-feat-desc">
              Keep your full grade history across your whole degree
            </div>
          </div>
        </div>

        <div className="gm-paywall-feature">
          <div className="gm-paywall-feat-icon" aria-hidden>
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v4M8 10v4M2 8h4M10 8h4"
                stroke="#0F6E56"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div className="gm-paywall-feat-name">Sync across all your devices</div>
            <div className="gm-paywall-feat-desc">
              Phone, laptop, tablet — your grades follow you
            </div>
          </div>
        </div>

        <div className="gm-paywall-price">
          <div>
            <div className="gm-paywall-price-amount">
              $2.42<span className="gm-paywall-price-suffix">/mo</span>
            </div>
            <div className="gm-paywall-price-sub">Billed once at $29/year</div>
          </div>
          <div className="gm-paywall-badge">Annual</div>
        </div>

        <ProCheckoutButton
          className="gm-paywall-cta"
          style={{ width: "100%" }}
        >
          Continue to checkout
        </ProCheckoutButton>
        <div
          style={{
            marginTop: 10,
            fontSize: 12.5,
            lineHeight: 1.35,
            color: "var(--color-text-tertiary)",
          }}
        >
          Founding members: use code <b>UQYEEHAW</b> for $19/year (≈ $1.60/mo).{" "}
          Limited to the first 100.
        </div>
        <button type="button" className="gm-paywall-skip" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

