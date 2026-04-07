"use client";

export function UpgradeModal({ onClose }: { onClose: () => void }) {
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
        style={{ width: "100%", maxWidth: 520, background: "var(--color-background-primary)" }}
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
          <h2 style={{ fontFamily: "var(--font-gm-serif)", fontSize: 22, margin: 0 }}>
            Track multiple semesters
          </h2>
          <p style={{ marginTop: 6, color: "var(--color-text-secondary)" }}>
            Upgrade to Pro to add more than one semester.
          </p>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--color-background-secondary)",
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>Monthly</div>
              <div style={{ fontFamily: "var(--font-gm-mono)", fontSize: 13, color: "var(--color-text-tertiary)" }}>
                $4.99 / month
              </div>
            </div>
            <button type="button" className="gm-btn-primary" disabled>
              Coming soon
            </button>
          </div>
          <div
            style={{
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--color-background-secondary)",
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>Yearly</div>
              <div style={{ fontFamily: "var(--font-gm-mono)", fontSize: 13, color: "var(--color-text-tertiary)" }}>
                $39 / year
              </div>
            </div>
            <button type="button" className="gm-btn-primary" disabled>
              Coming soon
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button type="button" className="gm-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

