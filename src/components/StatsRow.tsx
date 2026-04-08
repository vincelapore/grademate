import { formatMonoValue } from "@/components/utils/format";
import type { GradeBand } from "@/lib/grades";

type GradeBlock = { avg: number; band: GradeBand };

export function StatsRow({
  gpa,
  current,
  overall,
  allAssessmentsComplete,
  dueThisWeek,
  onViewHellWeeks,
}: {
  gpa: number | null;
  current: GradeBlock | null;
  overall: GradeBlock | null;
  allAssessmentsComplete: boolean;
  dueThisWeek: number;
  onViewHellWeeks?: () => void;
}) {
  return (
    <div className="gm-dash-stats">
      {!allAssessmentsComplete ? (
        <>
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

          {overall ? (
            <div className="gm-dash-grade-block gm-dash-grade-block--overall">
              <div className="gm-dash-stat-label">Overall</div>
              <div className="gm-dash-grade-value-row">
                <span className="gm-dash-grade-pct gm-dash-grade-pct--overall">
                  {overall.avg.toFixed(1)}%
                </span>
                <span className="gm-dash-grade-band">Grade {overall.band}</span>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="gm-dash-stat">
          <div className="gm-dash-stat-label">Semester GPA</div>
          <div className="gm-dash-stat-value">
            {gpa == null ? "—" : formatMonoValue(gpa, 2)}
          </div>
          {overall ? (
            <div className="gm-dash-stat-sub">
              <span>
                Final overall <strong>{overall.avg.toFixed(1)}%</strong>
              </span>
            </div>
          ) : null}
        </div>
      )}
      <div className="gm-dash-stat">
        <div className="gm-dash-stat-label">Due this week</div>
        <div
          className={`gm-dash-stat-value ${dueThisWeek > 0 ? "gm-dash-stat-value--amber" : ""}`}
        >
          {dueThisWeek}
        </div>
        {onViewHellWeeks ? (
          <button
            type="button"
            className="gm-dash-stat-hell-link"
            onClick={onViewHellWeeks}
          >
            View hell weeks
          </button>
        ) : null}
      </div>
    </div>
  );
}
