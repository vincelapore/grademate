"use client";

import {
  calculateEqualDistributionMarks,
  formatMarkDisplay,
  maxAchievableSubAssessmentPercent,
  parseMarkToPercentage,
  type WeightedMark
} from "@/lib/grades";
import { isValidMarkInput } from "@/lib/mark-input";
import {
  setWeightAt,
  withEqualWeightsFromRows
} from "@/lib/sub-assessment";
import type { SubAssessmentRow } from "@/lib/state";

type Props = {
  open: boolean;
  onClose: () => void;
  courseCode: string;
  assessmentName: string;
  /** Same emerald % as this row’s Mark placeholder on the course table (equal split to goal). */
  goalMarkPercent: number | null;
  assessmentCourseWeightPercent: number;
  courseMark: string | number | null;
  onCourseMarkChange: (value: string) => void;
  rows: SubAssessmentRow[];
  onRowsChange: (rows: SubAssessmentRow[]) => void;
};

function handleMarkChange(
  value: string,
  onUpdate: (v: string) => void
): void {
  const trimmed = value.trim();
  if (trimmed === "") {
    onUpdate("");
    return;
  }
  if (!isValidMarkInput(trimmed)) return;
  onUpdate(trimmed);
}

function goalHintText(pct: number): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

export function AssessmentCalculatorModal({
  open,
  onClose,
  courseCode,
  assessmentName,
  goalMarkPercent,
  assessmentCourseWeightPercent,
  courseMark,
  onCourseMarkChange,
  rows,
  onRowsChange
}: Props) {
  if (!open) return null;

  const courseWt = Math.max(0, Math.round(assessmentCourseWeightPercent));
  const weightSumRaw = rows.reduce(
    (s, r) => s + (typeof r.weight === "number" ? r.weight : 0),
    0
  );
  const subWeighted: WeightedMark[] = (() => {
    if (weightSumRaw <= 0) {
      const n = rows.length;
      const w = n > 0 ? 100 / n : 100;
      return rows.map((r) => ({ weight: w, mark: r.mark }));
    }
    return rows.map((r) => ({
      weight: ((typeof r.weight === "number" ? r.weight : 0) / weightSumRaw) * 100,
      mark: r.mark
    }));
  })();

  const parsedOverallPercent = parseMarkToPercentage(courseMark);

  const courseMarkEmpty =
    courseMark == null ||
    (typeof courseMark === "string" && courseMark.trim() === "");

  const cascadeTargetPercent =
    !courseMarkEmpty && parsedOverallPercent != null
      ? parsedOverallPercent
      : goalMarkPercent != null
        ? goalMarkPercent
        : parsedOverallPercent ?? null;

  const fillerMarks =
    cascadeTargetPercent != null
      ? calculateEqualDistributionMarks(subWeighted, cascadeTargetPercent)
      : rows.map(() => null as number | null);

  const showGoalHint = courseMarkEmpty && goalMarkPercent != null;
  const showGoalAsOverallPlaceholder = showGoalHint;

  const maxPossiblePercent = maxAchievableSubAssessmentPercent(
    rows.map((r) => ({
      mark: r.mark,
      weight: typeof r.weight === "number" ? r.weight : 0
    }))
  );
  const targetPercentForCap =
    cascadeTargetPercent != null ? cascadeTargetPercent : null;
  const targetUnachievable =
    maxPossiblePercent != null &&
    targetPercentForCap != null &&
    maxPossiblePercent + 0.05 < targetPercentForCap;

  const updateRow = (index: number, patch: Partial<SubAssessmentRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onRowsChange(next);
  };

  const addRow = () => {
    onRowsChange(
      withEqualWeightsFromRows(
        [
          ...rows,
          { name: `Part ${rows.length + 1}`, mark: null, weight: 0 }
        ],
        courseWt
      )
    );
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    onRowsChange(
      withEqualWeightsFromRows(
        rows.filter((_, i) => i !== index),
        courseWt
      )
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-200"
          aria-label="Close"
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
            <p className="text-xs text-slate-500">{courseCode}</p>
            <h2 className="text-lg font-bold text-slate-50">{assessmentName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Overall = Mark cell · parts share {courseWt}% of course
            </p>
          </div>

          {showGoalHint && (
            <p className="text-sm font-semibold text-emerald-400">
              Same as table: ~{goalHintText(goalMarkPercent!)}%
            </p>
          )}

          <div>
            <label className="text-xs text-slate-400">Overall mark</label>
            <input
              type="text"
              placeholder={
                showGoalAsOverallPlaceholder
                  ? goalHintText(goalMarkPercent!)
                  : "e.g. 8/10 or 72"
              }
              value={courseMark ?? ""}
              onChange={(e) =>
                handleMarkChange(e.target.value, onCourseMarkChange)
              }
              className={`mt-1 w-full rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-right text-sm font-semibold text-slate-50 outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 ${
                showGoalAsOverallPlaceholder
                  ? "placeholder:text-emerald-400/70"
                  : "placeholder:text-slate-600"
              }`}
            />
            {targetUnachievable && (
              <p className="mt-2 text-sm text-rose-300/95">
                Highest possible percentage is now about{" "}
                {maxPossiblePercent!.toFixed(1)}%. Lower your target here or
                change the goal grade on the course card.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Parts
              </p>
              <p
                className={`text-xs font-medium ${
                  weightSumRaw === courseWt
                    ? "text-slate-500"
                    : "text-amber-400/90"
                }`}
              >
                Weights: {weightSumRaw}% / {courseWt}%
              </p>
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => {
                const showPlaceholder =
                  !row.mark && fillerMarks[i] != null;
                const slashOnly = row.mark
                  ?.toString()
                  .trim()
                  .match(/^\/(\d+)$/);
                const w =
                  typeof row.weight === "number" ? row.weight : 0;

                return (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-lg border border-slate-800/50 bg-slate-950/30 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
                      <input
                        type="text"
                        placeholder="Name"
                        value={row.name}
                        onChange={(e) =>
                          updateRow(i, { name: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-700/50 bg-slate-900/50 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500/50"
                      />
                      <div className="flex shrink-0 items-center gap-1.5 sm:w-28">
                        <label className="sr-only" htmlFor={`w-${i}`}>
                          Weight for {row.name || "part"}
                        </label>
                        <input
                          id={`w-${i}`}
                          type="number"
                          min={0}
                          max={courseWt}
                          value={w}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isNaN(v)) return;
                            onRowsChange(
                              setWeightAt(rows, i, v, courseWt)
                            );
                          }}
                          className="w-full rounded-lg border border-slate-700/50 bg-slate-900/50 px-2 py-1.5 text-right text-sm font-medium text-slate-200 outline-none focus:border-sky-500/50"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col items-end gap-1 sm:max-w-[11rem]">
                        <div className="flex w-full items-start justify-end gap-2">
                          {showPlaceholder ? (
                            <input
                              type="text"
                              placeholder={fillerMarks[i]!.toFixed(0)}
                              value=""
                              onChange={(e) =>
                                handleMarkChange(e.target.value, (v) =>
                                  updateRow(i, {
                                    mark: v === "" ? null : v
                                  })
                                )
                              }
                              className="w-full max-w-[9rem] rounded-lg border border-slate-700/50 bg-slate-900/50 px-2 py-1.5 text-right text-sm font-semibold text-slate-50 outline-none placeholder:text-emerald-400/70 focus:border-sky-500/50"
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="e.g. 8/10"
                              value={row.mark ?? ""}
                              onChange={(e) =>
                                handleMarkChange(e.target.value, (v) =>
                                  updateRow(i, {
                                    mark: v === "" ? null : v
                                  })
                                )
                              }
                              className="w-full max-w-[9rem] rounded-lg border border-slate-700/50 bg-slate-900/50 px-2 py-1.5 text-right text-sm font-semibold text-slate-50 outline-none placeholder:text-slate-600 focus:border-sky-500/50"
                            />
                          )}
                          <button
                            type="button"
                            disabled={rows.length <= 1}
                            onClick={() => removeRow(i)}
                            className="shrink-0 rounded border border-slate-700/50 px-2 py-1.5 text-xs text-slate-400 hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-40"
                            aria-label="Remove row"
                          >
                            ×
                          </button>
                        </div>
                        {slashOnly && (
                          <span className="text-xs font-semibold text-emerald-400">
                            {(() => {
                              const denom = parseInt(slashOnly[1], 10);
                              const requiredPct = fillerMarks[i];
                              if (requiredPct == null) return "—";
                              const nn = Math.min(
                                denom,
                                Math.ceil((requiredPct * denom) / 100)
                              );
                              const actualPct = (nn / denom) * 100;
                              return (
                                <>
                                  {nn}/{denom}{" "}
                                  {actualPct >= 100
                                    ? "100"
                                    : actualPct <= 0
                                      ? "0"
                                      : actualPct.toFixed(1)}
                                  %
                                </>
                              );
                            })()}
                          </span>
                        )}
                        {(() => {
                          const displayMark =
                            row.mark ?? fillerMarks[i] ?? null;
                          const { percentage } =
                            formatMarkDisplay(displayMark);
                          if (percentage == null) return null;
                          return (
                            <span
                              className={`text-xs font-semibold ${!row.mark && fillerMarks[i] != null ? "text-emerald-400" : "text-slate-500"}`}
                            >
                              {percentage.toFixed(0)}%
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 w-full rounded-lg border border-dashed border-slate-600 py-2 text-xs font-medium text-slate-400 hover:border-sky-500/50 hover:text-sky-300"
            >
              + Add part
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
