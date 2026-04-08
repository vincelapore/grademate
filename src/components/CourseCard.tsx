"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreVertical, X } from "lucide-react";
import { CourseEditModal } from "@/components/CourseEditModal";
import { AssessmentCalculatorInline } from "@/components/AssessmentCalculatorInline";
import { safeHttpUrl } from "@/lib/profile-url";
import { isValidMarkInput } from "@/lib/mark-input";
import { formatDueDateForDisplay } from "@/lib/format-due-date";
import {
  aggregateSubAssessmentMarks,
  calculateEqualDistributionMarks,
  calculateRequiredMarkForTarget,
  calculateWeightedTotal,
  formatAggregateMarkForStorage,
  formatMarkDisplay,
  GRADE_BOUNDARY_PERCENTS,
  GRADE_THRESHOLDS,
  parseMarkToPercentage,
  percentToGradeBand,
} from "@/lib/grades";
import { ensureSubAssessmentRows } from "@/lib/sub-assessment";
import type { SubAssessmentRow } from "@/lib/state";

export type AssessmentSeriesSlot = "full" | "left" | "right";

type Assessment = {
  id: string;
  assessment_name: string;
  weighting: number;
  mark: string | null;
  due_date: string | null;
  sub_assessments?: { rows: SubAssessmentRow[] } | null;
  is_hurdle?: boolean | null;
  hurdle_threshold?: number | null;
  hurdle_requirements?: string | null;
  /** When multi-part assessments are modeled: two rows with `left` + `right` render as one paired circle. */
  series_slot?: AssessmentSeriesSlot;
};

function postgrestErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (e instanceof Error) return e.message;
  return "Could not remove course.";
}

function emitMarkChange(detail: {
  enrolmentId: string;
  assessmentId: string;
  mark: string | null;
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gm:mark-change", { detail }));
}

function emitPartsChange(detail: {
  enrolmentId: string;
  assessmentId: string;
  sub_assessments: { rows: SubAssessmentRow[] } | null;
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gm:parts-change", { detail }));
}

/** YYYY-MM-DD → sort key; missing/invalid dates sort last. */
function dueDateSortKey(due: string | null): number {
  if (due == null || !String(due).trim()) return Number.POSITIVE_INFINITY;
  const m = String(due).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function sortAssessmentsByDueDate(list: Assessment[]): Assessment[] {
  return [...list].sort((a, b) => {
    const da = dueDateSortKey(a.due_date);
    const db = dueDateSortKey(b.due_date);
    if (da !== db) return da - db;
    return a.assessment_name.localeCompare(b.assessment_name);
  });
}

/** Word-boundary match so titles like "example" are not treated as exams. */
function isExamAssessmentTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  return /\b(exam|exams|examination)\b/i.test(t);
}

function markTierForDot(
  pct: number | null,
): "empty" | "red" | "yellow" | "green" {
  if (pct == null || Number.isNaN(pct) || !Number.isFinite(pct)) return "empty";
  const p = Math.min(100, Math.max(0, pct));
  if (p < 50) return "red";
  if (p < 75) return "yellow";
  return "green";
}

const DOT_COLORS = {
  emptyStroke: "var(--gm-assess-dot-empty-stroke, rgba(15, 23, 42, 0.22))",
  red: "#e11d48",
  yellow: "#ca8a04",
  green: "var(--gm-accent, #1d9e75)",
} as const;

function AssessmentStatusDot({
  pct,
  fillMode,
  seriesSlot,
  shape,
}: {
  pct: number | null;
  fillMode?: "full" | "half";
  seriesSlot: AssessmentSeriesSlot;
  shape: "circle" | "square";
}) {
  const tier = markTierForDot(pct);
  const vb = 10;
  const c = vb / 2;
  const r = 3.85;
  const inset = c - r;
  const side = r * 2;
  const sqRx = 1;

  const fill =
    tier === "empty"
      ? "none"
      : tier === "red"
        ? DOT_COLORS.red
        : tier === "yellow"
          ? DOT_COLORS.yellow
          : "#1d9e75";
  const stroke =
    tier === "empty"
      ? DOT_COLORS.emptyStroke
      : "var(--gm-assess-dot-filled-stroke, rgba(15, 23, 42, 0.06))";
  const sw = tier === "empty" ? 1.35 : 0.85;
  const clipId = React.useId();

  const svg = (
    <svg
      width={11}
      height={11}
      viewBox={`0 0 ${vb} ${vb}`}
      className="gm-dash-assess-dot-svg"
      aria-hidden
    >
      {fillMode === "half" && tier !== "empty" ? (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={vb / 2} height={vb} />
          </clipPath>
        </defs>
      ) : null}

      {shape === "circle" ? (
        <>
          <circle cx={c} cy={c} r={r} fill="none" stroke={stroke} strokeWidth={sw} />
          {tier === "empty" ? null : fillMode === "half" ? (
            <circle
              cx={c}
              cy={c}
              r={r}
              fill={fill}
              clipPath={`url(#${clipId})`}
            />
          ) : (
            <circle cx={c} cy={c} r={r} fill={fill} />
          )}
        </>
      ) : (
        <>
          <rect
            x={inset}
            y={inset}
            width={side}
            height={side}
            rx={sqRx}
            ry={sqRx}
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
          />
          {tier === "empty" ? null : fillMode === "half" ? (
            <rect
              x={inset}
              y={inset}
              width={side}
              height={side}
              rx={sqRx}
              ry={sqRx}
              fill={fill}
              clipPath={`url(#${clipId})`}
            />
          ) : (
            <rect
              x={inset}
              y={inset}
              width={side}
              height={side}
              rx={sqRx}
              ry={sqRx}
              fill={fill}
            />
          )}
        </>
      )}
    </svg>
  );

  if (seriesSlot === "left") {
    return <span className="gm-dash-assess-clip gm-dash-assess-clip--left">{svg}</span>;
  }
  if (seriesSlot === "right") {
    return <span className="gm-dash-assess-clip gm-dash-assess-clip--right">{svg}</span>;
  }
  return svg;
}

function CollapsedAssessmentDots({
  items,
}: {
  items: Array<{
    id: string;
    pct: number | null;
    fillMode?: "full" | "half";
    series_slot: AssessmentSeriesSlot;
    shape: "circle" | "square";
  }>;
}) {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < items.length) {
    const cur = items[i]!;
    const next = items[i + 1];
    if (cur.series_slot === "left" && next?.series_slot === "right") {
      nodes.push(
        <span
          key={`${cur.id}-${next.id}`}
          role="listitem"
          className="gm-dash-assess-dots-item"
        >
          <span className="gm-dash-assess-dot-pair">
            <AssessmentStatusDot
              pct={cur.pct}
              fillMode={cur.fillMode}
              seriesSlot="left"
              shape={cur.shape}
            />
            <AssessmentStatusDot
              pct={next.pct}
              fillMode={next.fillMode}
              seriesSlot="right"
              shape={next.shape}
            />
          </span>
        </span>,
      );
      i += 2;
      continue;
    }
    nodes.push(
      <span key={cur.id} role="listitem" className="gm-dash-assess-dots-item">
        <AssessmentStatusDot
          pct={cur.pct}
          fillMode={cur.fillMode}
          seriesSlot={cur.series_slot ?? "full"}
          shape={cur.shape}
        />
      </span>,
    );
    i += 1;
  }

  const n = items.length;
  const done = items.filter((x) => x.pct != null).length;
  const label = `${n} assessment${n === 1 ? "" : "s"}, ${done} with marks entered`;

  return (
    <span className="gm-dash-assess-dots" role="list" aria-label={label}>
      {nodes}
    </span>
  );
}

function displayCourseTitle(code: string, name: string): string {
  const raw = name?.trim() ?? "";
  const cleaned = raw
    .replace(
      new RegExp(
        `\\s*\\(${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`,
        "i",
      ),
      "",
    )
    .trim();
  return cleaned ? `: ${cleaned}` : "";
}

function TargetGradeControl({
  domId,
  targetGrade,
  onChangeGrade,
}: {
  domId: string;
  targetGrade: number;
  onChangeGrade: (g: number) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 sm:self-center"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <label
        className="select-none text-[11px] font-medium text-[var(--color-text-tertiary)]"
        htmlFor={domId}
      >
        Target
      </label>
      <select
        id={domId}
        value={targetGrade}
        onChange={(e) => onChangeGrade(parseInt(e.target.value, 10))}
        className="gm-dash-select"
      >
        {[7, 6, 5, 4].map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </div>
  );
}

function CourseProgressBar({
  progressPct,
  className,
}: {
  progressPct: number;
  className?: string;
}) {
  const w = Math.min(100, Math.max(0, progressPct));
  return (
    <div className={`gm-dash-progress-wrap ${className ?? ""}`}>
      <div className="gm-dash-progress-track">
        <div className="gm-dash-progress-fill" style={{ width: `${w}%` }} />
      </div>
      <div className="gm-dash-progress-markers" aria-hidden>
        {GRADE_BOUNDARY_PERCENTS.map((pct) => (
          <span
            key={pct}
            className="gm-dash-progress-marker"
            style={{ left: `${pct}%` }}
            title={`${pct}%`}
          />
        ))}
      </div>
    </div>
  );
}

export function CourseCard({
  enrolment,
}: {
  enrolment: {
    id: string;
    course_code: string;
    course_name: string;
    credit_points: number;
    target_grade: number | null;
    profile_url: string | null;
    university: string | null;
    hurdle_information?: string | null;
    assessment_results: Assessment[];
  };
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const partsSaveSeqRef = useRef<Record<string, number>>({});

  const [meta, setMeta] = useState({
    code: enrolment.course_code,
    name: enrolment.course_name,
    cp: enrolment.credit_points,
    profileUrl: enrolment.profile_url,
    university: enrolment.university,
  });

  const [assessments, setAssessments] = useState<Assessment[]>(() =>
    sortAssessmentsByDueDate(enrolment.assessment_results ?? []),
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [targetGrade, setTargetGrade] = useState<number>(
    enrolment.target_grade ?? 7,
  );
  const [markHelpOpen, setMarkHelpOpen] = useState(false);
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(
    null,
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [hurdleOpen, setHurdleOpen] = useState<{
    assessmentId: string;
  } | null>(null);

  const assessmentSyncKey = (enrolment.assessment_results ?? [])
    .map(
      (a) =>
        `${a.id}-${a.assessment_name}-${a.weighting}-${a.due_date ?? ""}`,
    )
    .join("|");

  useEffect(() => {
    setMeta({
      code: enrolment.course_code,
      name: enrolment.course_name,
      cp: enrolment.credit_points,
      profileUrl: enrolment.profile_url,
      university: enrolment.university,
    });
  }, [
    enrolment.id,
    enrolment.course_code,
    enrolment.course_name,
    enrolment.credit_points,
    enrolment.profile_url,
    enrolment.university,
  ]);

  useEffect(() => {
    setAssessments(
      sortAssessmentsByDueDate(enrolment.assessment_results ?? []),
    );
  }, [enrolment.id, assessmentSyncKey]); // eslint-disable-line react-hooks/exhaustive-deps -- fingerprint sync

  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  function openEditModal() {
    setEditOpen(true);
  }

  async function confirmDeleteCourse() {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/dashboard/enrolments/${encodeURIComponent(enrolment.id)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" && json.error
            ? json.error
            : `Could not remove course (${res.status})`,
        );
      }
      setDeleteOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setDeleteError(postgrestErrorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  function formatMark(a: Assessment): string {
    return a.mark == null ? "" : String(a.mark);
  }

  const computed = React.useMemo(() => {
    const trimmedOrNull = (v: string | null | undefined): string | null => {
      const s = v == null ? "" : String(v).trim();
      return s ? s : null;
    };

    // Flatten assessments into grade-calculation items:
    // - If an assessment has parts, we ignore the parent mark entirely and emit one item per part.
    // - If not, we emit the parent assessment as a single item (draft overrides stored).
    const assessmentToFlatIndices: number[][] = [];
    const weightedItems: Array<{ weight: number; mark: string | null }> = [];

    assessments.forEach((a, assessmentIndex) => {
      const partRows = a.sub_assessments?.rows;
      const hasParts = (partRows?.length ?? 0) > 1;
      if (hasParts) {
        const rows = partRows!;
        const rawWeights = rows.map((r) =>
          typeof (r as { weight?: number }).weight === "number" &&
          Number.isFinite((r as { weight?: number }).weight) &&
          (r as { weight?: number }).weight! > 0
            ? (r as { weight?: number }).weight!
            : 0,
        );
        const wSum = rawWeights.reduce((s, w) => s + w, 0);
        const denom = wSum > 0 ? wSum : rows.length;

        const flatIndices: number[] = [];
        rows.forEach((r, rowIdx) => {
          const share =
            denom > 0
              ? (wSum > 0 ? rawWeights[rowIdx]! / denom : 1 / denom)
              : 0;
          weightedItems.push({
            weight: a.weighting * share,
            mark: trimmedOrNull(r.mark),
          });
          flatIndices.push(weightedItems.length - 1);
        });
        assessmentToFlatIndices[assessmentIndex] = flatIndices;
        return;
      }

      const raw = draft[a.id] !== undefined ? draft[a.id]! : formatMark(a);
      const t = raw.trim();
      const mark =
        t === "" || !isValidMarkInput(raw) ? null : trimmedOrNull(t);
      weightedItems.push({ weight: a.weighting, mark });
      assessmentToFlatIndices[assessmentIndex] = [weightedItems.length - 1];
    });

    const goalTarget =
      GRADE_THRESHOLDS[(targetGrade as 1 | 2 | 3 | 4 | 5 | 6 | 7) ?? 7];
    const total = calculateWeightedTotal(weightedItems);

    const fillerMarksFlat = calculateEqualDistributionMarks(
      weightedItems,
      goalTarget,
    );

    const lastIndex = weightedItems.length > 0 ? weightedItems.length - 1 : -1;

    const neededOnFinal =
      lastIndex >= 0
        ? calculateRequiredMarkForTarget(
            weightedItems,
            goalTarget,
            lastIndex,
          )
        : null;

    const hasEnteredMarks =
      weightedItems.some((it) => {
        const p = parseMarkToPercentage(it.mark);
        return p != null && Number.isFinite(p) && !Number.isNaN(p);
      });

    let maxPossibleTotal = 0;
    const maxAchievablePerItem: Array<number | null> = [];
    weightedItems.forEach((it, i) => {
      const w = typeof it.weight === "number" ? it.weight : 0;
      const p = parseMarkToPercentage(it.mark);
      if (p != null && Number.isFinite(p) && !Number.isNaN(p)) {
        maxAchievablePerItem[i] = p;
        maxPossibleTotal += (p * w) / 100;
        return;
      }
      // Blank/invalid: optimistic 100% at this item's proportional weight.
      maxAchievablePerItem[i] = 100;
      maxPossibleTotal += w;
    });

    const blockedByAssessmentCapForTarget = fillerMarksFlat.some((req, i) => {
      if (req == null || !Number.isFinite(req)) return false;
      const cap = maxAchievablePerItem[i];
      if (cap == null || !Number.isFinite(cap)) return false;
      return req > cap + 1e-9;
    });

    const bestPossibleGrade = (() => {
      // Find highest grade whose required per-assessment marks fit within caps.
      for (let g = targetGrade; g >= 1; g--) {
        const thr = GRADE_THRESHOLDS[g as 1 | 2 | 3 | 4 | 5 | 6 | 7];
        const reqs = calculateEqualDistributionMarks(weightedItems, thr);
        const blocked = reqs.some((req, i) => {
          if (req == null || !Number.isFinite(req)) return false;
          const cap = maxAchievablePerItem[i];
          if (cap == null || !Number.isFinite(cap)) return false;
          return req > cap + 1e-9;
        });
        if (!blocked) return g as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      }
      return 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    })();

    const isGoalAchievable =
      !hasEnteredMarks ||
      (!blockedByAssessmentCapForTarget && maxPossibleTotal >= goalTarget);
    const highestAchievableGrade = percentToGradeBand(maxPossibleTotal);
    const requiresPerfectScore =
      hasEnteredMarks && neededOnFinal != null && neededOnFinal >= 100;

    // Convert flat filler marks back to assessment-indexed filler marks for the table UI.
    const fillerMarks = assessments.map((_, idx) => {
      const flatIdxs = assessmentToFlatIndices[idx] ?? [];
      for (const fi of flatIdxs) {
        const v = fillerMarksFlat[fi];
        if (v != null && Number.isFinite(v)) {
          return Math.min(100, Math.ceil((Math.max(0, v) - 1e-9) * 10) / 10);
        }
      }
      return null;
    });

    return {
      weightedItems,
      goalTarget,
      total,
      fillerMarks,
      neededOnFinal,
      isGoalAchievable,
      highestAchievableGrade:
        isGoalAchievable ? highestAchievableGrade : bestPossibleGrade,
      requiresPerfectScore,
      hasEnteredMarks,
    };
  }, [assessments, targetGrade, draft]);

  const collapsedAssessmentDotItems = React.useMemo(() => {
    return assessments.map((a) => {
      const partRows = a.sub_assessments?.rows;
      const hasParts = (partRows?.length ?? 0) > 1;
      const anyPartEntered = hasParts
        ? partRows!.some((r) => {
            const s = r.mark == null ? "" : String(r.mark).trim();
            if (!s) return false;
            const p = parseMarkToPercentage(r.mark);
            return p != null && Number.isFinite(p) && !Number.isNaN(p);
          })
        : false;
      const allPartsComplete = hasParts
        ? partRows!.every((r) => {
            const s = r.mark == null ? "" : String(r.mark).trim();
            if (!s) return false;
            const p = parseMarkToPercentage(r.mark);
            return p != null && Number.isFinite(p) && !Number.isNaN(p);
          })
        : false;

      const raw =
        draft[a.id] !== undefined
          ? draft[a.id]!
          : a.mark == null
            ? ""
            : String(a.mark);
      const t = raw.trim();
      let pct: number | null = null;
      let fillMode: "full" | "half" | undefined = undefined;

      if (hasParts) {
        // If parts are in progress, show a half-filled dot in the tier based on
        // the currently entered parts (weighted by their part weights).
        if (!allPartsComplete && anyPartEntered) {
          const wSum = partRows!.reduce((s, r) => {
            const sMark = r.mark == null ? "" : String(r.mark).trim();
            const p = sMark ? parseMarkToPercentage(r.mark) : null;
            const w = typeof r.weight === "number" && r.weight > 0 ? r.weight : 0;
            return p != null && Number.isFinite(p) ? s + w : s;
          }, 0);
          const denom = wSum > 0 ? wSum : partRows!.filter((r) => {
            const sMark = r.mark == null ? "" : String(r.mark).trim();
            const p = sMark ? parseMarkToPercentage(r.mark) : null;
            return p != null && Number.isFinite(p);
          }).length;

          let acc = 0;
          partRows!.forEach((r) => {
            const sMark = r.mark == null ? "" : String(r.mark).trim();
            const p = sMark ? parseMarkToPercentage(r.mark) : null;
            if (p == null || !Number.isFinite(p)) return;
            const w = typeof r.weight === "number" && r.weight > 0 ? r.weight : 0;
            const ww = wSum > 0 ? w : 1;
            acc += p * ww;
          });
          pct = denom > 0 ? acc / denom : null;
          fillMode = "half";
        }
        // If all parts complete, we can use the stored/derived overall mark for full fill.
      }

      if (t !== "" && isValidMarkInput(raw)) {
        const p = parseMarkToPercentage(t.trim());
        pct =
          p != null && !Number.isNaN(p) && Number.isFinite(p) ? p : null;
      } else if (a.mark != null && String(a.mark).trim() !== "") {
        const p = parseMarkToPercentage(a.mark);
        pct =
          p != null && !Number.isNaN(p) && Number.isFinite(p) ? p : null;
      }

      if (hasParts && allPartsComplete && pct != null) {
        fillMode = "full";
      }
      const series_slot = a.series_slot ?? "full";
      const shape: "circle" | "square" = isExamAssessmentTitle(
        a.assessment_name,
      )
        ? "square"
        : "circle";
      return { id: a.id, pct, fillMode, series_slot, shape };
    });
  }, [assessments, draft]);

  async function saveAssessmentMark(assessmentId: string, value: string) {
    const trimmed = value.trim();
    const mark = trimmed === "" ? null : trimmed;
    const previous = assessments.find((a) => a.id === assessmentId);
    setAssessments((prev) =>
      prev.map((a) =>
        a.id === assessmentId
          ? { ...a, mark }
          : a,
      ),
    );
    emitMarkChange({ enrolmentId: enrolment.id, assessmentId, mark });

    const res = await fetch(
      `/api/dashboard/assessments/${encodeURIComponent(assessmentId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          mark,
        }),
      },
    );
    if (!res.ok) {
      if (previous) {
        setAssessments((prev) =>
          prev.map((a) => (a.id === assessmentId ? previous : a)),
        );
        emitMarkChange({
          enrolmentId: enrolment.id,
          assessmentId,
          mark: previous.mark == null ? null : String(previous.mark),
        });
      }
      void router.refresh();
    }
  }

  async function saveAssessmentParts(
    assessmentId: string,
    rows: SubAssessmentRow[] | null,
    mark?: string | null,
    seq?: number,
  ) {
    const expectedSeq =
      typeof seq === "number"
        ? seq
        : (partsSaveSeqRef.current[assessmentId] ?? 0);
    const res = await fetch(
      `/api/dashboard/assessments/${encodeURIComponent(assessmentId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(mark !== undefined ? { mark } : {}),
          sub_assessments: rows == null ? null : { rows },
        }),
      },
    );
    if (!res.ok) {
      return;
    }
    // UI is already updated optimistically. Avoid re-applying server results because
    // older in-flight saves can resolve later and "snap" the UI back temporarily.
    // Only keep a lightweight sequence check so callers can safely ignore stale responses.
    if ((partsSaveSeqRef.current[assessmentId] ?? 0) !== expectedSeq) return;
  }

  function updateSubAssessmentRows(
    assessmentId: string,
    rows: SubAssessmentRow[] | null,
  ) {
    setAssessments((prev) =>
      prev.map((a) =>
        a.id === assessmentId
          ? { ...a, sub_assessments: rows == null ? null : { rows } }
          : a,
      ),
    );
    emitPartsChange({
      enrolmentId: enrolment.id,
      assessmentId,
      sub_assessments: rows == null ? null : { rows },
    });
  }

  async function applySubAssessmentRows(
    assessmentId: string,
    rows: SubAssessmentRow[],
  ) {
    const nextSeq = (partsSaveSeqRef.current[assessmentId] ?? 0) + 1;
    partsSaveSeqRef.current[assessmentId] = nextSeq;

    // If a 2-part split is collapsed back to 1 row, treat it as "no parts".
    if (rows.length <= 1) {
      updateSubAssessmentRows(assessmentId, null);
      void saveAssessmentParts(assessmentId, null, undefined, nextSeq);
      return;
    }

    updateSubAssessmentRows(assessmentId, rows);
    const agg = aggregateSubAssessmentMarks(
      rows.map((r) => ({
        mark: r.mark,
        weight:
          typeof r.weight === "number" && !Number.isNaN(r.weight) ? r.weight : 0,
      })),
    );
    const derivedMark = formatAggregateMarkForStorage(agg);
    if (derivedMark != null) {
      setDraft((p) => ({ ...p, [assessmentId]: derivedMark }));
      emitMarkChange({
        enrolmentId: enrolment.id,
        assessmentId,
        mark: derivedMark,
      });
    }
    void saveAssessmentParts(
      assessmentId,
      rows,
      derivedMark == null ? undefined : derivedMark,
      nextSeq,
    );
  }

  async function flushDraftMarkToServer(assessmentId: string) {
    const draftValue = draft[assessmentId];
    if (draftValue === undefined) return;
    if (!isValidMarkInput(draftValue)) return;
    if (/^\/\d+$/.test(draftValue.trim())) return;
    await saveAssessmentMark(assessmentId, draftValue);
    setDraft((p) => {
      const next = { ...p };
      delete next[assessmentId];
      return next;
    });
  }

  async function updateTargetGrade(next: number) {
    const prevGrade = targetGrade;
    setTargetGrade(next);
    const res = await fetch(
      `/api/dashboard/enrolments/${encodeURIComponent(enrolment.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ target_grade: next }),
      },
    );
    if (!res.ok) {
      setTargetGrade(prevGrade);
      void router.refresh();
    }
  }

  const progressPct =
    computed.total != null && !Number.isNaN(computed.total)
      ? Math.min(100, computed.total)
      : 0;

  const collapsedStatus = (() => {
    if (!computed.hasEnteredMarks) {
      return null;
    }
    if (computed.isGoalAchievable) {
      if (
        computed.neededOnFinal != null &&
        !computed.requiresPerfectScore
      ) {
        return (
          <span className="text-[var(--color-text-tertiary)]">
            Need{" "}
            <span className="font-semibold text-[var(--gm-accent)]">
              {computed.neededOnFinal.toFixed(1)}%
            </span>{" "}
            on final
          </span>
        );
      }
      return (
        <span className="text-[var(--color-text-tertiary)]">
          On track for grade {targetGrade}
        </span>
      );
    }
    return (
      <span className="text-red-600">
        <span className="font-semibold">Goal {targetGrade} not achievable</span>
        {computed.highestAchievableGrade != null &&
          computed.highestAchievableGrade < targetGrade && (
            <span className="font-normal text-[var(--color-text-tertiary)]">
              {" "}
              · max grade {computed.highestAchievableGrade}
            </span>
          )}
      </span>
    );
  })();

  const safeProfileHref = safeHttpUrl(meta.profileUrl);

  return (
    <article className="gm-dash-card group">
      <div
        className={`flex min-w-0 items-start justify-between gap-3 ${expanded ? "border-b border-[var(--color-border-tertiary)] pb-4" : ""}`}
      >
        <button
          type="button"
          className="group flex min-w-0 flex-1 items-start gap-1.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[rgba(29,158,117,0.35)]"
          aria-expanded={expanded}
          aria-controls={`course-body-${enrolment.id}`}
          onClick={() => setExpanded((e) => !e)}
        >
          <ChevronDown
            className={`mt-[3px] h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)] opacity-40 transition-[transform,opacity] duration-200 group-hover:opacity-70 ${expanded ? "" : "-rotate-90"}`}
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="gm-dash-course-title min-w-0">
              <span className="break-words">
                {meta.code}
                {displayCourseTitle(meta.code, meta.name)}
              </span>
              {safeProfileHref ? (
                <a
                  href={`${safeProfileHref}#assessment`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View course profile"
                  aria-label="View course profile"
                  className="ml-1 inline-flex shrink-0 align-middle rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-secondary)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ) : null}
            </div>
            <p className="gm-dash-course-meta gm-dash-course-meta--with-dots">
              <span className="gm-dash-course-meta-inline">
                <strong className="gm-dash-course-meta-pct">
                  {computed.total != null && !Number.isNaN(computed.total)
                    ? `${computed.total.toFixed(1)}%`
                    : "—"}
                </strong>
                {!expanded ? (
                  <CollapsedAssessmentDots
                    items={collapsedAssessmentDotItems}
                  />
                ) : null}
              </span>
            </p>
          </div>
        </button>

        <div
          className="flex shrink-0 items-center gap-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="gm-dash-icon-btn"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Course options"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((o) => !o);
              }}
            >
              <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
            </button>
            {menuOpen ? (
              <div
                className="gm-dash-menu absolute right-0 top-full z-40 mt-1"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="gm-dash-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    openEditModal();
                  }}
                >
                  Course settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="gm-dash-menu-item gm-dash-menu-item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteError(null);
                    setDeleteOpen(true);
                  }}
                >
                  Remove course
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!expanded ? (
        <div className="mt-4 pl-7">
          <CourseProgressBar progressPct={progressPct} />
          {collapsedStatus ? (
            <p className="mt-2 line-clamp-2 text-xs leading-snug text-[var(--color-text-secondary)]">
              {collapsedStatus}
            </p>
          ) : null}
        </div>
      ) : null}

      <div id={`course-body-${enrolment.id}`} hidden={!expanded}>
        <div className="pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <CourseProgressBar progressPct={progressPct} />
            </div>
            <TargetGradeControl
              domId={`target-grade-${enrolment.id}`}
              targetGrade={targetGrade}
              onChangeGrade={(g) => void updateTargetGrade(g)}
            />
          </div>
          {computed.hasEnteredMarks ? (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {computed.isGoalAchievable ? (
                computed.neededOnFinal != null &&
                !computed.requiresPerfectScore ? (
                  <>
                    Need{" "}
                    <span className="font-semibold text-[var(--gm-accent)]">
                      {computed.neededOnFinal.toFixed(1)}%
                    </span>{" "}
                    on your last weighted assessment
                  </>
                ) : (
                  <>On track for grade {targetGrade}</>
                )
              ) : (
                <span className="text-red-600">
                  <span className="font-semibold">
                    Grade {targetGrade} is not reachable
                  </span>
                  {computed.highestAchievableGrade != null &&
                    computed.highestAchievableGrade < targetGrade && (
                      <span className="text-[var(--color-text-tertiary)]">
                        {" "}
                        (best possible: {computed.highestAchievableGrade})
                      </span>
                    )}
                </span>
              )}
            </p>
          ) : null}
        </div>

        <div className="gm-dash-table-wrap">
          <table className="gm-dash-table">
            <thead>
              <tr>
                <th scope="col">Assessment</th>
                <th scope="col" className="gm-dash-th-num">
                  Weight
                </th>
                <th scope="col" className="gm-dash-th-num">
                  Due
                </th>
                <th scope="col" className="gm-dash-th-num">
                  <span className="inline-flex items-center justify-end gap-1">
                    Mark
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMarkHelpOpen(true);
                      }}
                      className="gm-dash-icon-btn"
                      aria-label="How to enter marks"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
            {assessments.map((a, i) => {
              const stored = formatMark(a);
              const value = draft[a.id] !== undefined ? draft[a.id]! : stored;
              const invalid = value.trim() !== "" && !isValidMarkInput(value);
              const fill = computed.fillerMarks[i];
              const fillerPlaceholder =
                !stored && value.trim() === "" && fill != null;

              const slashOnly = value.trim().match(/^\/(\d+)$/);
              const slashDenom = slashOnly
                ? parseInt(slashOnly[1]!, 10)
                : null;

              const livePct =
                value.trim() !== "" && isValidMarkInput(value)
                  ? parseMarkToPercentage(value.trim())
                  : null;

              const markHint = (() => {
                if (!computed.isGoalAchievable) return null;
                if (slashDenom != null) {
                  const requiredPctRaw = computed.fillerMarks[i];
                  const requiredPct =
                    requiredPctRaw == null || !Number.isFinite(requiredPctRaw)
                      ? null
                      : Math.min(
                          100,
                          Math.ceil((Math.max(0, requiredPctRaw) - 1e-9) * 10) /
                            10,
                        );
                  if (requiredPct == null) {
                    return (
                      <span className="gm-dash-mark-pct gm-dash-mark-pct--accent">
                        —
                      </span>
                    );
                  }
                  const nn = Math.min(
                    slashDenom,
                    Math.ceil((requiredPct * slashDenom) / 100),
                  );
                  const actualPct = (nn / slashDenom) * 100;
                  const pctStr =
                    actualPct >= 100
                      ? "100"
                      : actualPct <= 0
                        ? "0"
                        : actualPct.toFixed(1);
                  return (
                    <span className="gm-dash-mark-pct gm-dash-mark-pct--accent">
                      {nn}/{slashDenom} ({pctStr}%)
                    </span>
                  );
                }
                if (livePct != null && !Number.isNaN(livePct)) {
                  return (
                    <span className="gm-dash-mark-pct">{livePct.toFixed(0)}%</span>
                  );
                }
                if (!stored && fill != null) {
                  const { percentage } = formatMarkDisplay(fill);
                  if (percentage == null) return null;
                  // Use a conservative display so entering the hint reaches the band
                  // (grade thresholds do not round up).
                  const display = Math.min(
                    100,
                    Math.ceil((percentage - 1e-9) * 10) / 10,
                  );
                  return (
                    <span className="gm-dash-mark-pct gm-dash-mark-pct--accent">
                      ~{display.toFixed(0)}%
                    </span>
                  );
                }
                return null;
              })();

              const isExpanded = expandedAssessmentId === a.id;
              return (
                <React.Fragment key={a.id}>
                <tr
                  onClick={() => {
                    setExpandedAssessmentId((cur) => (cur === a.id ? null : a.id));
                  }}
                >
                  <td data-label="Assessment">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="gm-dash-assess-name">{a.assessment_name}</div>
                        {(a.is_hurdle ||
                          (a.hurdle_requirements != null &&
                            a.hurdle_requirements.trim() !== "") ||
                          a.hurdle_threshold != null) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHurdleOpen({ assessmentId: a.id });
                            }}
                            className="inline-flex items-center rounded-md border border-amber-600/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 hover:border-amber-600/45 hover:bg-amber-500/15"
                            title="Hurdle requirement"
                          >
                            Hurdle
                          </button>
                        )}
                      </div>
                      {(a.sub_assessments?.rows?.length ?? 0) > 1 ? (
                        <div className="text-[11px] text-[var(--color-text-tertiary)]">
                          {(() => {
                            const rows = a.sub_assessments?.rows ?? [];
                            const completed = rows.reduce((acc, r) => {
                              const str = r.mark == null ? "" : String(r.mark).trim();
                              if (!str) return acc;
                              const p = parseMarkToPercentage(r.mark);
                              return p != null && Number.isFinite(p) && !Number.isNaN(p)
                                ? acc + 1
                                : acc;
                            }, 0);
                            return `${completed} out of ${rows.length} complete`;
                          })()}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="Weight" className="gm-dash-td-num gm-dash-td-muted">
                    {a.weighting}%
                  </td>
                  <td data-label="Due" className="gm-dash-td-num gm-dash-td-muted">
                    {formatDueDateForDisplay(a.due_date)}
                  </td>
                  <td data-label="Mark" className="gm-dash-td-num">
                    <div className="gm-dash-mark-cell">
                      {(a.sub_assessments?.rows?.length ?? 0) > 1
                        ? (() => {
                            const rows = a.sub_assessments!.rows!;
                            const weights = rows.map((r) =>
                              typeof (r as { weight?: number }).weight === "number"
                                ? (r as { weight?: number }).weight!
                                : 0,
                            );

                            const entered = rows.map((r) => {
                              const str = r.mark == null ? "" : String(r.mark).trim();
                              const pct = str ? parseMarkToPercentage(r.mark) : null;
                              return {
                                raw: str,
                                pct:
                                  pct != null && Number.isFinite(pct) && !Number.isNaN(pct)
                                    ? pct
                                    : null,
                              };
                            });
                            const anyEntered = entered.some((e) => e.pct != null);
                            const allComplete = entered.every((e) => e.pct != null);

                            const wSumAll = weights.reduce((s, w) => s + (w > 0 ? w : 0), 0);
                            const wSumEntered = entered.reduce((s, e, i2) => {
                              if (e.pct == null) return s;
                              const w = weights[i2] ?? 0;
                              return s + (w > 0 ? w : 0);
                            }, 0);

                            const denom =
                              wSumAll > 0 ? wSumEntered : entered.filter((e) => e.pct != null).length;
                            const numer = entered.reduce((s, e, i2) => {
                              if (e.pct == null) return s;
                              const w = weights[i2] ?? 0;
                              const ww = wSumAll > 0 ? (w > 0 ? w : 0) : 1;
                              return s + e.pct * ww;
                            }, 0);
                            const pctNow =
                              denom > 0 ? Math.max(0, Math.min(100, numer / denom)) : null;

                            // If all parts are entered as x/y, show total x/y + percentage.
                            const frac = (s: string): { n: number; d: number } | null => {
                              const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
                              if (!m) return null;
                              const n = Number(m[1]);
                              const d = Number(m[2]);
                              if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
                              return { n, d };
                            };
                            const allFractions = allComplete && entered.every((e) => frac(e.raw) != null);
                            const fracTotal = allFractions
                              ? entered.reduce(
                                  (acc, e) => {
                                    const f = frac(e.raw)!;
                                    return { n: acc.n + f.n, d: acc.d + f.d };
                                  },
                                  { n: 0, d: 0 },
                                )
                              : null;

                            const displayPct =
                              allFractions && fracTotal && fracTotal.d > 0
                                ? (fracTotal.n / fracTotal.d) * 100
                                : pctNow;
                            const pctLabel =
                              displayPct != null && Number.isFinite(displayPct)
                                ? `${Math.round(displayPct)}%`
                                : null;

                            const requiredAssessmentPct =
                              typeof fill === "number" && Number.isFinite(fill)
                                ? Math.max(0, Math.min(100, fill))
                                : null;

                            const enteredWeighted = entered.reduce((s, e, i2) => {
                              if (e.pct == null) return s;
                              const w = weights[i2] ?? 0;
                              const ww = wSumAll > 0 ? (w > 0 ? w : 0) : 1;
                              return s + e.pct * ww;
                            }, 0);
                            const totalWeight =
                              wSumAll > 0 ? wSumAll : entered.length;
                            const enteredWeight =
                              wSumAll > 0
                                ? wSumEntered
                                : entered.filter((e) => e.pct != null).length;
                            const remainingWeight = Math.max(
                              0,
                              totalWeight - enteredWeight,
                            );

                            const maxAchievablePct =
                              totalWeight > 0
                                ? Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      (enteredWeighted + remainingWeight * 100) /
                                        totalWeight,
                                    ),
                                  )
                                : null;

                            // requiredAssessmentPct is the required overall % for this assessment (from course goal).

                            const dots =
                              rows.length > 1 ? (
                                <div className="mt-1 flex justify-end gap-1">
                                  {entered.map((e, idx2) => (
                                    <AssessmentStatusDot
                                      key={`${a.id}-part-dot-${idx2}`}
                                      pct={e.pct}
                                      seriesSlot="full"
                                      shape="circle"
                                    />
                                  ))}
                                </div>
                              ) : null;

                            if (!allComplete) {
                              // In progress: show current-from-entered in black + required/max in green.
                              const currentLabel = anyEntered ? pctLabel : "0%";
                              const reqLabel =
                                !computed.isGoalAchievable
                                  ? null
                                  : requiredAssessmentPct == null
                                    ? null
                                    : requiredAssessmentPct <= 100
                                      ? `~${Math.round(requiredAssessmentPct)}%`
                                      : maxAchievablePct != null
                                        ? `max ${Math.round(maxAchievablePct)}%`
                                        : null;
                              return (
                                <div className="flex flex-col items-end">
                                  <span className="font-semibold text-[var(--color-text-primary)]">
                                    {currentLabel ?? "—"}
                                    {reqLabel ? (
                                      <span className="ml-2 gm-dash-mark-pct gm-dash-mark-pct--accent">
                                        {reqLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                  {dots}
                                </div>
                              );
                            }

                            // Complete: calculated mark in black (and x/y total when applicable).
                            return (
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-[var(--color-text-primary)]">
                                  {allFractions && fracTotal ? (
                                    <>
                                      {Number.isInteger(fracTotal.n) ? String(fracTotal.n) : fracTotal.n.toFixed(1)}
                                      /
                                      {Number.isInteger(fracTotal.d) ? String(fracTotal.d) : fracTotal.d.toFixed(1)}
                                      {pctLabel ? (
                                        <span className="ml-2 text-[var(--color-text-tertiary)]">
                                          {pctLabel}
                                        </span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <>
                                      {pctLabel ?? "—"}
                                    </>
                                  )}
                                </span>
                                {dots}
                              </div>
                            );
                          })()
                        : (
                          <>
                            <input
                              type="text"
                              inputMode="text"
                              enterKeyHint="done"
                              autoCapitalize="off"
                              autoCorrect="off"
                              placeholder={
                                fillerPlaceholder && fill != null
                                  ? String(Math.round(fill))
                                  : "8/10 or 50"
                              }
                              value={value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const next = e.target.value;
                                setDraft((p) => ({
                                  ...p,
                                  [a.id]: next,
                                }));
                                const t = next.trim();
                                if (
                                  t !== "" &&
                                  !isValidMarkInput(next)
                                ) {
                                  return;
                                }
                                emitMarkChange({
                                  enrolmentId: enrolment.id,
                                  assessmentId: a.id,
                                  mark: t === "" ? null : t,
                                });
                              }}
                              onBlur={async (e) => {
                                const v = e.target.value;
                                if (/^\/\d+$/.test(v.trim())) return;
                                setDraft((p) => {
                                  const copy = { ...p };
                                  delete copy[a.id];
                                  return copy;
                                });
                                if (!isValidMarkInput(v)) return;
                                await saveAssessmentMark(a.id, v);
                              }}
                              className={`gm-dash-mark-input ${fillerPlaceholder ? "gm-dash-mark-input--hint" : ""} ${invalid ? "gm-dash-mark-input--invalid" : ""}`}
                            />
                            {markHint}
                          </>
                        )}
                    </div>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr>
                    <td colSpan={4} onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const goalMarkPercent = computed.fillerMarks[i] ?? null;
                        const assessmentCourseWeight =
                          typeof a.weighting === "number" ? Math.round(a.weighting) : 0;
                        const rows: SubAssessmentRow[] = ensureSubAssessmentRows(
                          a.sub_assessments?.rows?.length
                            ? a.sub_assessments.rows.map((r) => ({
                                name: r.name,
                                mark: r.mark,
                                weight: (r as { weight?: number }).weight,
                              }))
                            : [{ name: "Part 1", mark: null }],
                          assessmentCourseWeight,
                        );
                        return (
                          <div className="px-3 pb-4 pt-2">
                            <AssessmentCalculatorInline
                              assessmentName={a.assessment_name}
                              requiredMark={goalMarkPercent}
                              hideGoal={!computed.isGoalAchievable}
                              assessmentCourseWeightPercent={assessmentCourseWeight}
                              rows={rows}
                              onRowsChange={(next) => void applySubAssessmentRows(a.id, next)}
                            />
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {/* Inline calculator renders under the expanded assessment row. */}

      {markHelpOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="gm-dash-modal-backdrop"
              onClick={() => setMarkHelpOpen(false)}
              role="presentation"
            >
              <div
                className="gm-dash-modal-panel gm-dash-modal-panel--wide"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`dashboard-mark-help-${enrolment.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="gm-dash-modal-header">
                  <h2
                    id={`dashboard-mark-help-${enrolment.id}`}
                    className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]"
                  >
                    How to enter marks
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMarkHelpOpen(false)}
                    className="gm-dash-modal-close"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </header>
                <div className="gm-dash-modal-body space-y-4 pb-6 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      1. Enter a percentage
                    </p>
                    <p className="mt-1">
                      Type a number like <span className="font-mono">50</span>{" "}
                      for <span className="font-mono">50%</span>.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      2. Enter marks out of a total
                    </p>
                    <p className="mt-1">
                      Use a fraction like <span className="font-mono">8/10</span>{" "}
                      or <span className="font-mono">24/30</span>.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      3. See required marks for your goal grade
                    </p>
                    <p className="mt-1">
                      Type <span className="font-mono">/50</span> in a mark
                      field to see how many marks out of 50 you need for your
                      target grade.
                    </p>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {hurdleOpen != null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center gm-univ-modal-overlay backdrop-blur-sm p-4"
              onClick={() => setHurdleOpen(null)}
              role="presentation"
            >
              {(() => {
                const a = assessments.find((x) => x.id === hurdleOpen.assessmentId);
                if (!a) return null;

                const threshold =
                  a.hurdle_threshold != null
                    ? `Pass threshold: ${a.hurdle_threshold}%`
                    : null;
                const courseText =
                  enrolment.hurdle_information != null &&
                  enrolment.hurdle_information.trim()
                    ? enrolment.hurdle_information.trim()
                    : null;
                const itemText =
                  a.hurdle_requirements != null && a.hurdle_requirements.trim()
                    ? a.hurdle_requirements.trim()
                    : null;
                const hurdleText = itemText ?? courseText ?? null;

                return (
                  <div
                    className="relative gm-univ-modal w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`dash-hurdle-${hurdleOpen.assessmentId}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setHurdleOpen(null)}
                      className="absolute right-4 top-4 rounded-lg p-1.5 gm-univ-muted transition-all gm-univ-hover-surface gm-univ-hover-fg"
                      aria-label="Close"
                      type="button"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    <div className="space-y-4 pr-8">
                      <div>
                        <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                          Hurdle
                        </span>
                        <h2
                          id={`dash-hurdle-${hurdleOpen.assessmentId}`}
                          className="mt-2 text-lg font-bold tracking-tight gm-univ-fg"
                        >
                          {a.assessment_name}
                        </h2>
                        <p className="text-sm gm-univ-muted">{meta.code}</p>
                      </div>

                      {threshold && (
                        <p className="text-sm font-medium text-amber-300/90">
                          {threshold}
                        </p>
                      )}

                      {hurdleText && (
                        <div className="rounded-xl border gm-univ-border gm-univ-surface p-4">
                          <p className="whitespace-pre-wrap text-sm gm-univ-muted-strong">
                            {hurdleText}
                          </p>
                        </div>
                      )}

                      {!hurdleText && !threshold && (
                        <p className="text-sm gm-univ-muted">
                          No hurdle details available for this item.
                        </p>
                      )}

                      {safeProfileHref ? (
                        <a
                          href={`${safeProfileHref}#assessment`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gm-univ-btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          View course profile
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </div>,
            document.body,
          )
        : null}

      <CourseEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        enrolmentId={enrolment.id}
        courseCode={meta.code}
        courseName={meta.name}
        creditPoints={meta.cp}
        profileUrl={meta.profileUrl}
        university={meta.university}
        assessments={assessments}
        onSaved={(next) =>
          setMeta({
            code: next.code,
            name: next.name,
            cp: next.cp,
            profileUrl: next.profileUrl,
            university: next.university,
          })
        }
      />

      {/* Components editor is inline (assessment row dropdown). */}

      {deleteOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="gm-dash-modal-backdrop"
              onClick={() => !deleteBusy && setDeleteOpen(false)}
              role="presentation"
            >
              <div
                className="gm-dash-modal-panel gm-dash-modal-panel--sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`course-delete-${enrolment.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="gm-dash-modal-body">
                  <h2
                    id={`course-delete-${enrolment.id}`}
                    className="text-lg font-semibold text-[var(--color-text-primary)]"
                  >
                    Remove this course?
                  </h2>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    {meta.code} will be removed from this semester, including all
                    assessment marks. This cannot be undone.
                  </p>
                  {deleteError ? (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                      {deleteError}
                    </p>
                  ) : null}
                </div>
                <footer className="gm-dash-modal-footer">
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => setDeleteOpen(false)}
                    className="gm-dash-modal-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => void confirmDeleteCourse()}
                    className="gm-dash-modal-btn gm-dash-modal-btn--danger"
                  >
                    {deleteBusy ? "Removing…" : "Remove course"}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
