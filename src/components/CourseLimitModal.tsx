"use client";

import { UpgradeModal } from "@/components/UpgradeModal";

export function CourseLimitModal({ onClose }: { onClose: () => void }) {
  return (
    <UpgradeModal
      onClose={onClose}
    />
  );
}

