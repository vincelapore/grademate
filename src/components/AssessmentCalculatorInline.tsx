"use client";

import { calculateEqualDistributionMarks } from "@/lib/grades";
import { parseMarkToPercentage } from "@/lib/grades";
import { isValidMarkInput } from "@/lib/mark-input";
import { setWeightAt, withEqualWeightsFromRows } from "@/lib/sub-assessment";
import type { SubAssessmentRow } from "@/lib/state";

type Props = {
  assessmentName: string;
  goalMarkPercent: number | null;
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
  goalMarkPercent,
  assessmentCourseWeightPercent,
  rows,
  onRowsChange,
}: Props) {
  const courseWt = Math.max(0, Math.round(assessmentCourseWeightPercent));
  const weightSumRaw = rows.reduce(
    (s, r) => s + (typeof r.weight === "number" ? r.weight : 0),
    0,
  );
  const fillerMarks =
    goalMarkPercent != null
      ? calculateEqualDistributionMarks(
          rows.map((r) => ({
            weight: typeof r.weight === "number" ? r.weight : 0,
            mark: r.mark,
          })),
          goalMarkPercent,
        )
      : rows.map(() => null as number | null);

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
            const showPlaceholder = !row.mark && fillerMarks[i] != null;
            const w = typeof row.weight === "number" ? row.weight : 0;
            const raw = row.mark == null ? "" : String(row.mark);
            const slashOnly = raw.trim().match(/^\/(\d+)$/);
            const slashDenom = slashOnly ? parseInt(slashOnly[1]!, 10) : null;
            const livePct =
              raw.trim() !== "" && isValidMarkInput(raw)
                ? parseMarkToPercentage(raw.trim())
                : null;
            const markHint = (() => {
              if (slashDenom != null) {
                const requiredPct = fillerMarks[i];
                if (requiredPct == null) {
                  return (
                    <span className="gm-dash-parts-hint gm-dash-mark-pct--accent">
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
                  <span className="gm-dash-parts-hint gm-dash-mark-pct--accent">
                    {nn}/{slashDenom} ({pctStr}%)
                  </span>
                );
              }
              if (livePct != null && !Number.isNaN(livePct)) {
                return (
                  <span className="gm-dash-parts-hint">
                    {livePct.toFixed(0)}%
                  </span>
                );
              }
              if (!raw.trim() && fillerMarks[i] != null) {
                return (
                  <span className="gm-dash-parts-hint gm-dash-mark-pct--accent">
                    ~{fillerMarks[i]!.toFixed(0)}%
                  </span>
                );
              }
              return null;
            })();
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
                    placeholder={showPlaceholder ? fillerMarks[i]!.toFixed(0) : "8/10"}
                    value={showPlaceholder ? "" : row.mark ?? ""}
                    onChange={(e) =>
                      handleMarkChange(e.target.value, (v) =>
                        updateRow(i, { mark: v === "" ? null : v }),
                      )
                    }
                    className="gm-dash-parts-input gm-dash-parts-num"
                    aria-label={`Mark for ${row.name || `part ${i + 1}`}`}
                  />
                  {markHint}
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

