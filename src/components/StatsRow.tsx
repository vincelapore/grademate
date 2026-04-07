import { formatMonoValue } from "@/components/utils/format";

export function StatsRow({
  gpa,
  dueThisWeek,
  degreeProgressPercent,
}: {
  gpa: number | null;
  dueThisWeek: number;
  degreeProgressPercent: number;
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
