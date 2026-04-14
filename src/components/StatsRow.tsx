import type { GradeBand } from "@/lib/grades";

type GradeBlock = { avg: number; band: GradeBand };

export function StatsRow({
  current,
}: {
  current: GradeBlock | null;
}) {
  const currentLabel =
    current != null
      ? `Current: Grade ${current.band} (${current.avg.toFixed(1)}%)`
      : "Current: —";

  return (
    <div className="gm-dash-stats gm-dash-stats--subtitle" aria-label="Summary">
      <div className="gm-dash-substat">
        <span className="gm-dash-substat-value gm-dash-substat-value--accent">
          {currentLabel}
        </span>
      </div>
    </div>
  );
}
