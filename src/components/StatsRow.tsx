import { formatMonoValue } from "@/components/utils/format";

export function StatsRow({
  gpa,
  dueThisWeek,
  degreeProgressPercent,
  onViewHellWeeks,
}: {
  gpa: number | null;
  dueThisWeek: number;
  degreeProgressPercent: number;
  onViewHellWeeks?: () => void;
}) {
  return (
    <div className="gm-dash-stats">
      <div className="gm-dash-stat">
        <div className="gm-dash-stat-label">Semester GPA</div>
        <div className="gm-dash-stat-value">
          {gpa == null ? "—" : formatMonoValue(gpa, 2)}
        </div>
      </div>
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
      <div className="gm-dash-stat">
        <div className="gm-dash-stat-label">Degree progress</div>
        <div className="gm-dash-stat-value gm-dash-stat-value--green">
          {degreeProgressPercent}%
        </div>
      </div>
    </div>
  );
}
