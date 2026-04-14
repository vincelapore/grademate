"use client";

import { ProCheckoutButton } from "@/components/ProCheckoutButton";

export function UpgradeModal({
  onClose,
}: {
  onClose: () => void;
}) {
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
        <h2 className="gm-paywall-title">You're tracking 3 courses</h2>
        <p className="gm-paywall-sub">
          Most students take 4. Upgrade to add more — and unlock the good stuff.
        </p>

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
              $19<span className="gm-paywall-price-suffix">/year</span>
            </div>
            <div className="gm-paywall-price-sub">Less than $1.60/month</div>
          </div>
          <div className="gm-paywall-badge">Founding rate</div>
        </div>

        <ProCheckoutButton
          tier="founding_annual"
          className="gm-paywall-cta"
          style={{ width: "100%" }}
        >
          Unlock Grademate Pro
        </ProCheckoutButton>
        <button type="button" className="gm-paywall-skip" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

