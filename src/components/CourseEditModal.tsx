"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeProfileUrlForStorage,
  normalizeUniversityCode,
} from "@/lib/profile-url";
import { formatMonoValue } from "@/components/utils/format";

type CourseEditAssessment = {
  id: string;
  assessment_name: string;
  weighting: number;
  mark: string | null;
  due_date: string | null;
  is_hurdle?: boolean | null;
  hurdle_threshold?: number | null;
  hurdle_requirements?: string | null;
};

type AssessmentFormRow = {
  clientKey: string;
  id?: string;
  assessment_name: string;
  weighting: string;
  due_date: string;
  is_hurdle: boolean;
  hurdle_threshold: string;
  hurdle_requirements: string;
};

function formRowsFromAssessments(list: CourseEditAssessment[]): AssessmentFormRow[] {
  return list.map((a) => ({
    clientKey: a.id,
    id: a.id,
    assessment_name: a.assessment_name,
    weighting: String(a.weighting),
    due_date: a.due_date ?? "",
    is_hurdle: Boolean(a.is_hurdle),
    hurdle_threshold:
      a.hurdle_threshold == null ? "" : String(a.hurdle_threshold),
    hurdle_requirements: a.hurdle_requirements ?? "",
  }));
}

function rowHasStoredMark(row: AssessmentFormRow, source: CourseEditAssessment[]): boolean {
  if (!row.id) return false;
  const a = source.find((x) => x.id === row.id);
  return a != null && a.mark != null && String(a.mark).trim() !== "";
}

export function CourseEditModal({
  open,
  onClose,
  enrolmentId,
  courseCode,
  courseName,
  creditPoints,
  profileUrl,
  university,
  assessments,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  enrolmentId: string;
  courseCode: string;
  courseName: string;
  creditPoints: number;
  profileUrl: string | null;
  university: string | null;
  assessments: CourseEditAssessment[];
  onSaved: (next: {
    code: string;
    name: string;
    cp: number;
    profileUrl: string | null;
    university: string | null;
  }) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editCp, setEditCp] = useState("");
  const [editProfileUrl, setEditProfileUrl] = useState("");
  const [editUniversity, setEditUniversity] = useState("");
  const [editRows, setEditRows] = useState<AssessmentFormRow[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEditCode(courseCode);
    setEditName(courseName);
    setEditCp(String(creditPoints));
    setEditProfileUrl(profileUrl?.trim() ?? "");
    setEditUniversity(university?.trim() ?? "");
    setEditRows(formRowsFromAssessments(assessments));
    setEditError(null);
    setPendingRemoveKey(null);
    const t = window.setTimeout(() => codeInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [
    open,
    courseCode,
    courseName,
    creditPoints,
    profileUrl,
    university,
    assessments,
  ]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !editSaving) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, editSaving, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const weightSumPreview = editRows.reduce((s, r) => {
    const w = parseFloat(r.weighting);
    return s + (Number.isFinite(w) ? w : 0);
  }, 0);

  const weightMeterClass =
    Math.abs(weightSumPreview - 100) < 0.05
      ? "gm-dash-weight-meter-fill--ok"
      : weightSumPreview > 100
        ? "gm-dash-weight-meter-fill--over"
        : "gm-dash-weight-meter-fill--low";

  function addEditRow() {
    setPendingRemoveKey(null);
    setEditRows((rows) => [
      ...rows,
      {
        clientKey: globalThis.crypto?.randomUUID?.() ?? `new-${Date.now()}`,
        assessment_name: "",
        weighting: "10.0",
        due_date: "",
        is_hurdle: false,
        hurdle_threshold: "",
        hurdle_requirements: "",
      },
    ]);
  }

  function removeEditRow(clientKey: string) {
    setEditRows((rows) => rows.filter((r) => r.clientKey !== clientKey));
    setPendingRemoveKey(null);
  }

  function requestRemoveRow(row: AssessmentFormRow) {
    setPendingRemoveKey(null);
    if (row.id) {
      setPendingRemoveKey(row.clientKey);
      return;
    }
    removeEditRow(row.clientKey);
  }

  async function saveEditModal() {
    setEditError(null);
    const code = editCode.trim().toUpperCase();
    const name = editName.trim();
    const cp = parseInt(editCp, 10);
    if (!code || !name) {
      setEditError("Course code and name are required.");
      return;
    }
    if (!Number.isFinite(cp) || cp < 1 || cp > 32) {
      setEditError("Credit points must be a whole number between 1 and 32.");
      return;
    }

    let normalizedProfile: string | null = null;
    if (editProfileUrl.trim()) {
      try {
        normalizedProfile = normalizeProfileUrlForStorage(editProfileUrl);
      } catch {
        setEditError(
          "Course profile URL must be a valid http(s) link, or leave it blank.",
        );
        return;
      }
    }
    const normalizedUni = normalizeUniversityCode(editUniversity);

    const normalizedRows = editRows
      .map((r) => ({
        ...r,
        assessment_name: r.assessment_name.trim(),
        weighting: parseFloat(r.weighting),
        due_date: r.due_date.trim() || null,
        hurdle_threshold: r.hurdle_threshold.trim(),
        hurdle_requirements: r.hurdle_requirements.trim(),
      }))
      .filter(
        (r) =>
          r.assessment_name.length > 0 &&
          Number.isFinite(r.weighting) &&
          r.weighting > 0,
      );

    setEditSaving(true);
    try {
      const { error: uErr } = await supabase
        .from("subject_enrolments")
        .update({
          course_code: code,
          course_name: name,
          credit_points: cp,
          profile_url: normalizedProfile,
          university: normalizedUni,
        })
        .eq("id", enrolmentId);
      if (uErr) throw uErr;

      const keptIds = new Set(
        normalizedRows.filter((r) => r.id).map((r) => r.id as string),
      );
      for (const a of assessments) {
        if (!keptIds.has(a.id)) {
          const { error: dErr } = await supabase
            .from("assessment_results")
            .delete()
            .eq("id", a.id);
          if (dErr) throw dErr;
        }
      }

      for (const r of normalizedRows) {
        const due = r.due_date;
        const hurdleThreshold =
          r.hurdle_threshold === "" ? null : Number(r.hurdle_threshold);
        const hurdleRequirements =
          r.hurdle_requirements === "" ? null : r.hurdle_requirements;
        if (r.id) {
          const { error: upErr } = await supabase
            .from("assessment_results")
            .update({
              assessment_name: r.assessment_name,
              weighting: r.weighting,
              due_date: due,
              is_hurdle: r.is_hurdle,
              hurdle_threshold:
                hurdleThreshold != null && Number.isFinite(hurdleThreshold)
                  ? Math.round(hurdleThreshold)
                  : null,
              hurdle_requirements: hurdleRequirements,
            })
            .eq("id", r.id);
          if (upErr) throw upErr;
        } else {
          const { error: inErr } = await supabase
            .from("assessment_results")
            .insert({
              subject_enrolment_id: enrolmentId,
              assessment_name: r.assessment_name,
              weighting: r.weighting,
              mark: null,
              due_date: due,
              is_hurdle: r.is_hurdle,
              hurdle_threshold:
                hurdleThreshold != null && Number.isFinite(hurdleThreshold)
                  ? Math.round(hurdleThreshold)
                  : null,
              hurdle_requirements: hurdleRequirements,
            });
          if (inErr) throw inErr;
        }
      }

      onSaved({
        code,
        name,
        cp,
        profileUrl: normalizedProfile,
        university: normalizedUni,
      });
      onClose();
      router.refresh();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setEditSaving(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="gm-dash-modal-backdrop"
      onClick={() => !editSaving && onClose()}
      role="presentation"
    >
      <div
        className="gm-dash-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`gm-dash-edit-course-title-${enrolmentId}`}
        aria-describedby={`gm-dash-edit-course-desc-${enrolmentId}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gm-dash-modal-header">
          <div className="min-w-0 pr-10">
            <h2
              id={`gm-dash-edit-course-title-${enrolmentId}`}
              className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
            >
              Course settings
            </h2>
            <p
              id={`gm-dash-edit-course-desc-${enrolmentId}`}
              className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]"
            >
              Update course details and assessment weights. Entered marks stay
              attached when you rename items or change due dates.
            </p>
          </div>
          <button
            type="button"
            disabled={editSaving}
            onClick={() => onClose()}
            className="gm-dash-modal-close"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="gm-dash-modal-body">
          <section className="mb-6">
            <h3 className="gm-dash-modal-section-title">Course</h3>
            <p className="gm-dash-modal-section-hint">
              Code and name appear on your dashboard. Credit points are used for
              semester GPA. Link your official course profile page when you have
              one.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="gm-dash-field-label-block" htmlFor="edit-course-code">
                  Course code
                </label>
                <input
                  ref={codeInputRef}
                  id="edit-course-code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  className="gm-dash-input mt-1.5"
                  autoComplete="off"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="gm-dash-field-label-block" htmlFor="edit-course-cp">
                  Credit points
                </label>
                <input
                  id="edit-course-cp"
                  type="number"
                  min={1}
                  max={32}
                  step={1}
                  value={editCp}
                  onChange={(e) => setEditCp(e.target.value)}
                  className="gm-dash-input mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="gm-dash-field-label-block" htmlFor="edit-course-name">
                  Course name
                </label>
                <input
                  id="edit-course-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="gm-dash-input mt-1.5"
                  placeholder="e.g. Functional and Logic Programming"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  className="gm-dash-field-label-block"
                  htmlFor="edit-course-profile-url"
                >
                  Course profile URL{" "}
                  <span className="font-normal text-[var(--color-text-tertiary)]">
                    (optional)
                  </span>
                </label>
                <input
                  id="edit-course-profile-url"
                  type="url"
                  inputMode="url"
                  value={editProfileUrl}
                  onChange={(e) => setEditProfileUrl(e.target.value)}
                  className="gm-dash-input mt-1.5"
                  placeholder="https://course-profiles.uq.edu.au/…"
                  autoComplete="off"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  className="gm-dash-field-label-block"
                  htmlFor="edit-course-university"
                >
                  University{" "}
                  <span className="font-normal text-[var(--color-text-tertiary)]">
                    (optional)
                  </span>
                </label>
                <input
                  id="edit-course-university"
                  value={editUniversity}
                  onChange={(e) => setEditUniversity(e.target.value)}
                  className="gm-dash-input mt-1.5"
                  placeholder="e.g. uq or qut"
                  autoComplete="off"
                />
                <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                  Short code only (lowercase). Shown on your card for reference.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="gm-dash-modal-section-title">Assessments</h3>
                <p className="gm-dash-modal-section-hint gm-dash-modal-section-hint--flush">
                  Each item needs a name and a positive weight. Totals usually add
                  up to 100%.
                </p>
              </div>
              <button
                type="button"
                onClick={addEditRow}
                className="gm-dash-modal-btn gm-dash-modal-btn--accent-soft inline-flex shrink-0 items-center gap-1.5"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Add assessment
              </button>
            </div>

            <div className="gm-dash-weight-meter">
              <div className="gm-dash-weight-meter-track" aria-hidden>
                <div
                  className={`gm-dash-weight-meter-fill ${weightMeterClass}`}
                  style={{
                    width: `${Math.min(100, weightSumPreview)}%`,
                  }}
                />
              </div>
              <div className="gm-dash-weight-meter-caption">
                <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {Number.isFinite(weightSumPreview)
                    ? formatMonoValue(weightSumPreview)
                    : "—"}
                  %
                </span>
                <span className="text-[var(--color-text-tertiary)]"> / 100%</span>
                {Math.abs(weightSumPreview - 100) < 0.05 ? (
                  <span className="ml-auto text-xs font-medium text-[var(--gm-accent)]">
                    Balanced
                  </span>
                ) : weightSumPreview > 100 ? (
                  <span className="ml-auto text-xs font-medium text-red-600">
                    Over 100% — check weights
                  </span>
                ) : (
                  <span className="ml-auto text-xs font-medium text-amber-700">
                    Under 100% — OK if intentional
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {editRows.map((row, index) => {
                const showRemoveConfirm = pendingRemoveKey === row.clientKey;
                const hasMark = rowHasStoredMark(row, assessments);
                return (
                  <div
                    key={row.clientKey}
                    className={`gm-dash-edit-assess-card ${showRemoveConfirm ? "gm-dash-edit-assess-card--warn" : ""}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        Assessment {index + 1}
                      </span>
                      {!showRemoveConfirm ? (
                        <button
                          type="button"
                          onClick={() => requestRemoveRow(row)}
                          className="gm-dash-icon-btn text-[var(--color-text-tertiary)] hover:text-red-600"
                          aria-label={`Remove assessment ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      ) : null}
                    </div>

                    {showRemoveConfirm ? (
                      <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5 text-sm text-red-900">
                        <p className="font-medium">Remove this assessment?</p>
                        {hasMark ? (
                          <p className="mt-1 text-xs leading-snug opacity-90">
                            Saved marks for this row will be permanently deleted.
                          </p>
                        ) : (
                          <p className="mt-1 text-xs leading-snug opacity-90">
                            You can add it again later if needed.
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => removeEditRow(row.clientKey)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingRemoveKey(null)}
                            className="rounded-lg border border-[var(--color-border-secondary)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                          >
                            Keep
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="gm-dash-field-label-block text-[var(--color-text-tertiary)]">
                            Name
                          </label>
                          <input
                            value={row.assessment_name}
                            onChange={(e) =>
                              setEditRows((rows) =>
                                rows.map((r) =>
                                  r.clientKey === row.clientKey
                                    ? { ...r, assessment_name: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            className="gm-dash-input mt-1"
                            placeholder="e.g. Final exam"
                          />
                        </div>
                        <div>
                          <label className="gm-dash-field-label-block text-[var(--color-text-tertiary)]">
                            Weight (%)
                          </label>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            inputMode="decimal"
                            value={row.weighting}
                            onChange={(e) =>
                              setEditRows((rows) =>
                                rows.map((r) =>
                                  r.clientKey === row.clientKey
                                    ? { ...r, weighting: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            className="gm-dash-input mt-1 tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="gm-dash-field-label-block text-[var(--color-text-tertiary)]">
                            Due date
                          </label>
                          <input
                            type="date"
                            value={row.due_date}
                            onChange={(e) =>
                              setEditRows((rows) =>
                                rows.map((r) =>
                                  r.clientKey === row.clientKey
                                    ? { ...r, due_date: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            className="gm-dash-input mt-1"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                            <input
                              type="checkbox"
                              checked={row.is_hurdle}
                              onChange={(e) =>
                                setEditRows((rows) =>
                                  rows.map((r) =>
                                    r.clientKey === row.clientKey
                                      ? { ...r, is_hurdle: e.target.checked }
                                      : r,
                                  ),
                                )
                              }
                            />
                            Hurdle
                          </label>
                        </div>
                        {(row.is_hurdle ||
                          row.hurdle_threshold.trim() !== "" ||
                          row.hurdle_requirements.trim() !== "") && (
                          <>
                            <div>
                              <label className="gm-dash-field-label-block text-[var(--color-text-tertiary)]">
                                Pass threshold (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={row.hurdle_threshold}
                                onChange={(e) =>
                                  setEditRows((rows) =>
                                    rows.map((r) =>
                                      r.clientKey === row.clientKey
                                        ? { ...r, hurdle_threshold: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                                className="gm-dash-input mt-1 tabular-nums"
                                placeholder="e.g. 50"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="gm-dash-field-label-block text-[var(--color-text-tertiary)]">
                                Hurdle requirements
                              </label>
                              <textarea
                                value={row.hurdle_requirements}
                                onChange={(e) =>
                                  setEditRows((rows) =>
                                    rows.map((r) =>
                                      r.clientKey === row.clientKey
                                        ? { ...r, hurdle_requirements: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                                className="gm-dash-input mt-1"
                                rows={3}
                                placeholder="e.g. Must score at least 50% on the final exam."
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {editRows.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                No assessments yet.{" "}
                <button
                  type="button"
                  onClick={addEditRow}
                  className="font-semibold text-[var(--gm-accent)] underline-offset-2 hover:underline"
                >
                  Add your first one
                </button>
              </p>
            ) : null}

            {editError ? (
              <p className="mt-4 text-sm font-medium text-red-600" role="alert">
                {editError}
              </p>
            ) : null}
          </section>
        </div>

        <footer className="gm-dash-modal-footer">
          <button
            type="button"
            disabled={editSaving}
            onClick={() => onClose()}
            className="gm-dash-modal-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={editSaving}
            onClick={() => void saveEditModal()}
            className="gm-dash-modal-btn gm-dash-modal-btn--primary"
          >
            {editSaving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
