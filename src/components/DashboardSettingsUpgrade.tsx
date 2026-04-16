"use client";

import { useState } from "react";
import { UpgradeModal } from "@/components/UpgradeModal";

export function DashboardSettingsUpgrade() {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <>
      <button
        type="button"
        className="gm-dash-btn"
        onClick={() => setShowUpgrade(true)}
      >
        Upgrade
      </button>
      {showUpgrade ? (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      ) : null}
    </>
  );
}
