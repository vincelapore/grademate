"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SemesterSelection } from "@/lib/semester";
import { AddCourseSearch } from "@/components/AddCourseSearch";

type Step = 1 | 2 | 3;

export function OnboardingFlow({
  initialSemester,
}: {
  initialSemester: SemesterSelection;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [university, setUniversity] = useState<"uq" | null>(null);
  const [semesterId, setSemesterId] = useState<string | null>(null);

  async function chooseUniversity(value: "uq") {
    setError(null);
    setSaving(true);
    setUniversity(value);
    const res = await fetch("/api/onboarding/university", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ university: value }),
    });
    const jsonUnknown: unknown = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      const msg =
        typeof jsonUnknown === "object" && jsonUnknown != null && "error" in jsonUnknown
          ? String((jsonUnknown as { error: unknown }).error)
          : "Please sign in again.";
      setError(msg);
      return;
    }
    setStep(2);
  }

  async function confirmSemester() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/onboarding/semester", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: initialSemester.year,
        semester: initialSemester.semester,
      }),
    });
    const jsonUnknown: unknown = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      const msg =
        typeof jsonUnknown === "object" && jsonUnknown != null && "error" in jsonUnknown
          ? String((jsonUnknown as { error: unknown }).error)
          : "Could not create semester.";
      setError(msg);
      return;
    }

    const id =
      typeof jsonUnknown === "object" && jsonUnknown != null && "id" in jsonUnknown
        ? String((jsonUnknown as { id: unknown }).id)
        : null;
    if (!id) {
      setError("Could not create semester.");
      return;
    }

    setSemesterId(id);
    setStep(3);
  }

  async function finish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="gm-card">
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "var(--font-gm-mono)",
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--color-text-tertiary)",
          }}
        >
          Setup · Step {step} of 3
        </div>
        <h1 style={{ fontFamily: "var(--font-gm-serif)", fontSize: 26 }}>
          Let’s set up your semester
        </h1>
        <p style={{ marginTop: 6, color: "var(--color-text-secondary)" }}>
          This takes about a minute.
        </p>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 12,
            border: "0.5px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.08)",
            padding: "10px 12px",
            borderRadius: 12,
            color: "#ef4444",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
            Pick your university
          </div>

          <button
            type="button"
            className="gm-btn-primary"
            style={{ width: "100%", justifyContent: "space-between" }}
            onClick={() => chooseUniversity("uq")}
            disabled={saving}
          >
            <span>University of Queensland (UQ)</span>
            <span style={{ fontFamily: "var(--font-gm-mono)", fontSize: 12 }}>
              Available
            </span>
          </button>

          <div
            style={{
              display: "grid",
              gap: 8,
              marginTop: 4,
              color: "var(--color-text-tertiary)",
              fontSize: 13,
            }}
          >
            <div
              style={{
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>QUT</span>
              <span style={{ fontFamily: "var(--font-gm-mono)", fontSize: 12 }}>
                Coming soon
              </span>
            </div>
            <div
              style={{
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>UniMelb</span>
              <span style={{ fontFamily: "var(--font-gm-mono)", fontSize: 12 }}>
                Coming soon
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
            Confirm your current semester
          </div>

          <div
            style={{
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 12,
              padding: "12px 14px",
              background: "var(--color-background-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-gm-mono)", fontSize: 13 }}>
                {initialSemester.semester}, {initialSemester.year}
              </div>
              <div style={{ color: "var(--color-text-tertiary)", fontSize: 13 }}>
                {university === "uq" ? "UQ" : university}
              </div>
            </div>
            <button
              type="button"
              className="gm-btn-primary"
              onClick={confirmSemester}
              disabled={saving}
              style={{ padding: "10px 18px" }}
            >
              Confirm →
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && semesterId && university ? (
        <AddCourseSearch
          university={university}
          semesterId={semesterId}
          year={initialSemester.year}
          semesterLabel={initialSemester.semester}
          delivery={initialSemester.delivery}
          onDone={finish}
        />
      ) : null}
    </div>
  );
}

