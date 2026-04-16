"use client";

import { useState } from "react";
import { AddSemesterModal } from "@/components/AddSemesterModal";
import { UpgradeModal } from "@/components/UpgradeModal";

export function AddSemesterButton({
  className,
  plan = "free",
  semesterCount,
}: {
  className?: string;
  plan?: "free" | "pro";
  semesterCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className ?? "gm-dash-btn"}
        onClick={() => {
          if (plan !== "pro") {
            setUpgradeOpen(true);
            return;
          }
          setOpen(true);
        }}
      >
        Add semester
      </button>
      {open ? <AddSemesterModal onClose={() => setOpen(false)} /> : null}
      {upgradeOpen ? (
        <UpgradeModal
          reason="semesters"
          semesterCount={semesterCount}
          onClose={() => setUpgradeOpen(false)}
        />
      ) : null}
    </>
  );
}

