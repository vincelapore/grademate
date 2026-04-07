"use client";

export function CourseLimitModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="gm-card"
        style={{
          width: "100%",
          maxWidth: 720,
          background: "var(--color-background-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontFamily: "var(--font-gm-mono)",
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            Pro required
          </div>
          <h2
            style={{
              fontFamily: "var(--font-gm-serif)",
              fontSize: 22,
              margin: 0,
            }}
          >
            Add more than 4 courses
          </h2>
          <p style={{ marginTop: 6, color: "var(--color-text-secondary)" }}>
            Free includes up to 4 courses per semester. Upgrade to Pro to track
            more.
          </p>
        </div>

        <div className="gm-price-grid" style={{ marginTop: 6 }}>
          <div className="gm-price-card featured" style={{ background: "var(--color-background-secondary)" }}>
            <div className="gm-price-badge">Founding rate — limited time</div>
            <div className="gm-price-tier">FOUNDING ANNUAL</div>
            <div className="gm-price-row">
              <div className="gm-price-amount">$1.58</div>
              <div className="gm-price-suffix">/mo</div>
            </div>
            <div className="gm-price-secondary">billed once at $19/year</div>
            <div className="gm-price-save">Save 69% vs monthly</div>
            <button type="button" className="gm-btn-primary" disabled style={{ width: "100%" }}>
              Coming soon
            </button>
          </div>

          <div className="gm-price-card" style={{ background: "var(--color-background-secondary)" }}>
            <div className="gm-price-badge subtle">Most popular</div>
            <div className="gm-price-tier">ANNUAL</div>
            <div className="gm-price-row">
              <div className="gm-price-amount">$3.25</div>
              <div className="gm-price-suffix">/mo</div>
            </div>
            <div className="gm-price-secondary">billed once at $39/year</div>
            <div className="gm-price-save">Save 35% vs monthly</div>
            <button type="button" className="gm-btn-primary" disabled style={{ width: "100%" }}>
              Coming soon
            </button>
          </div>

          <div className="gm-price-card" style={{ background: "var(--color-background-secondary)" }}>
            <div className="gm-price-tier">MONTHLY</div>
            <div className="gm-price-row">
              <div className="gm-price-amount">$4.99</div>
              <div className="gm-price-suffix">/mo</div>
            </div>
            <div className="gm-price-secondary">billed monthly, cancel anytime</div>
            <button type="button" className="gm-btn-primary" disabled style={{ width: "100%" }}>
              Coming soon
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 14,
          }}
        >
          <button type="button" className="gm-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

