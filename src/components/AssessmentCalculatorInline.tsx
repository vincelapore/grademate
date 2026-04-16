"use client";

import { parseMarkToPercentage } from "@/lib/grades";
import { isValidMarkInput } from "@/lib/mark-input";
import { setWeightAt, withEqualWeightsFromRows } from "@/lib/sub-assessment";
import type { SubAssessmentRow } from "@/lib/state";

type Props = {
  assessmentName: string;
  requiredMark: number | null;
  hideGoal?: boolean;
  assessmentCourseWeightPercent: number;
  rows: SubAssessmentRow[];
  onRowsChange: (rows: SubAssessmentRow[]) => void;
};

function handleMarkChange(value: string, onUpdate: (v: string) => void): void {
  const trimmed = value.trim();
  if (trimmed === "") {
    onUpdate("");
    return;
  }
  if (!isValidMarkInput(trimmed)) return;
  onUpdate(trimmed);
}

export function AssessmentCalculatorInline({
  assessmentName,
  requiredMark,
  hideGoal = false,
  assessmentCourseWeightPercent,
  rows,
  onRowsChange,
}: Props) {
  const courseWt = Math.max(0, Math.round(assessmentCourseWeightPercent));
  const weights = rows.map((r) => (typeof r.weight === "number" ? r.weight : 0));
  const weightSumRaw = rows.reduce(
    (s, r) => s + (typeof r.weight === "number" ? r.weight : 0),
    0,
  );

  const partsMath = (() => {
    const totalWeightRaw = weights.reduce((s, w) => s + (w > 0 ? w : 0), 0);
    const useEqual = totalWeightRaw <= 0;
    const totalWeight = useEqual ? Math.max(1, rows.length) : totalWeightRaw;

    const enteredPcts = rows.map((r) => {
      const raw = r.mark == null ? "" : String(r.mark).trim();
      const pct =
        raw !== "" && isValidMarkInput(raw) ? parseMarkToPercentage(raw) : null;
      return pct != null && Number.isFinite(pct) && !Number.isNaN(pct)
        ? pct
        : null;
    });

    let earnedPercent = 0;
    let remainingWeight = 0;
    for (let i = 0; i < enteredPcts.length; i++) {
      const w = useEqual ? 1 : Math.max(0, weights[i] ?? 0);
      const p = enteredPcts[i];
      if (p == null) {
        remainingWeight += w;
      } else {
        earnedPercent += (p * w) / totalWeight;
      }
    }

    const bestPossible =
      earnedPercent + (remainingWeight > 0 ? (100 * remainingWeight) / totalWeight : 0);

    return {
      totalWeight,
      useEqual,
      enteredPcts,
      earnedPercent,
      remainingWeight,
      bestPossible,
    };
  })();

  const clampedRequired =
    requiredMark != null && Number.isFinite(requiredMark)
      ? Math.max(0, Math.min(100, requiredMark))
      : null;

  // If some parts are already entered, the remaining parts may need a different
  // average mark than the overall required mark.
  const requiredRemainingAvg =
    !hideGoal &&
    clampedRequired != null &&
    partsMath.remainingWeight > 0 &&
    Number.isFinite(partsMath.earnedPercent)
      ? Math.max(
          0,
          Math.min(
            100,
            ((clampedRequired - partsMath.earnedPercent) * partsMath.totalWeight) /
              partsMath.remainingWeight,
          ),
        )
      : null;

  const updateRow = (index: number, patch: Partial<SubAssessmentRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onRowsChange(next);
  };

  const addRow = () => {
    onRowsChange(
      withEqualWeightsFromRows(
        [...rows, { name: `Part ${rows.length + 1}`, mark: null, weight: 0 }],
        courseWt,
      ),
    );
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    onRowsChange(withEqualWeightsFromRows(rows.filter((_, i) => i !== index), courseWt));
  };

  const isSingle = rows.length <= 1;

  return (
    <div className="gm-dash-parts">
      {isSingle ? (
        <button
          type="button"
          className="gm-dash-parts-split"
          onClick={() => {
            const first = rows[0] ?? { name: "Part 1", mark: null, weight: courseWt };
            const next = withEqualWeightsFromRows(
              [
                {
                  name: first.name?.trim() ? first.name : "Part 1",
                  mark: first.mark ?? null,
                  weight: 0,
                },
                { name: "Part 2", mark: null, weight: 0 },
              ],
              courseWt,
            );
            onRowsChange(next);
          }}
        >
          Split into parts
        </button>
      ) : (
        <div className="gm-dash-parts-grid">
          {rows.map((row, i) => {
            const w = typeof row.weight === "number" ? row.weight : 0;
            const raw = row.mark == null ? "" : String(row.mark);
            const livePct =
              raw.trim() !== "" && isValidMarkInput(raw)
                ? parseMarkToPercentage(raw.trim())
                : null;
            const showGoalPlaceholder =
              livePct == null &&
              !hideGoal &&
              (requiredRemainingAvg != null ||
                (clampedRequired != null && Number.isFinite(clampedRequired)));
            const placeholderPct =
              requiredRemainingAvg != null ? requiredRemainingAvg : clampedRequired;
            const displayRequired =
              placeholderPct == null
                ? null
                : Math.min(100, Math.ceil((placeholderPct - 1e-9) * 10) / 10);
            return (
              <div key={i} className="gm-dash-parts-row">
                <input
                  type="text"
                  placeholder="Part name"
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  className="gm-dash-parts-input gm-dash-parts-name"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={courseWt}
                  value={w}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isNaN(v)) return;
                    onRowsChange(setWeightAt(rows, i, v, courseWt));
                  }}
                  className="gm-dash-parts-input gm-dash-parts-num"
                  placeholder="%"
                  aria-label={`Weight for ${row.name || `part ${i + 1}`}`}
                />
                <div className="gm-dash-parts-due" aria-hidden />
                <div className="gm-dash-parts-mark">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={
                      showGoalPlaceholder && displayRequired != null
                        ? `~${Math.ceil(displayRequired)}%`
                        : ""
                    }
                    value={row.mark ?? ""}
                    onChange={(e) =>
                      handleMarkChange(e.target.value, (v) =>
                        updateRow(i, { mark: v === "" ? null : v }),
                      )
                    }
                    className={`gm-dash-parts-input gm-dash-parts-num ${showGoalPlaceholder ? "gm-dash-parts-input--goal" : ""}`}
                    aria-label={`Mark for ${row.name || `part ${i + 1}`}`}
                  />
                  <button
                    type="button"
                    disabled={rows.length <= 1}
                    onClick={() => removeRow(i)}
                    className="gm-dash-parts-delete"
                    aria-label="Delete part"
                    title="Delete part"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
          {weightSumRaw !== courseWt ? (
            <div className="gm-dash-parts-warn" role="status">
              Weights should add to {courseWt}% (currently {weightSumRaw}%)
            </div>
          ) : (
            <div className="gm-dash-parts-ok" aria-hidden />
          )}
          <button type="button" onClick={addRow} className="gm-dash-parts-add">
            + Add part
          </button>
        </div>
      )}
    </div>
  );
}

