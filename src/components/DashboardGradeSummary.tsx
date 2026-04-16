import type { GradeBand } from "@/lib/grades";

type GradeBlock = { avg: number; band: GradeBand };

export function DashboardGradeSummary({
  current,
  overall,
}: {
  current: GradeBlock | null;
  overall: GradeBlock | null;
}) {
  if (overall == null) {
    return (
      <div className="gm-dash-grade-summary gm-dash-grade-summary--empty">
        Add a course to get started
      </div>
    );
  }

  return (
    <div className="gm-dash-grade-summary">
      {current ? (
        <div className="gm-dash-grade-block gm-dash-grade-block--current">
          <div className="gm-dash-stat-label">Current grade</div>
          <div className="gm-dash-grade-value-row">
            <span className="gm-dash-grade-pct gm-dash-grade-pct--accent">
              {current.avg.toFixed(1)}%
            </span>
            <span className="gm-dash-grade-band">Grade {current.band}</span>
          </div>
        </div>
      ) : null}
      <div className="gm-dash-grade-block gm-dash-grade-block--overall">
        <div className="gm-dash-stat-label">Overall</div>
        <div className="gm-dash-grade-value-row">
          <span className="gm-dash-grade-pct gm-dash-grade-pct--overall">
            {overall.avg.toFixed(1)}%
          </span>
          <span className="gm-dash-grade-band">Grade {overall.band}</span>
        </div>
      </div>
    </div>
  );
}
