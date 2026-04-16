import type { GradeBand } from "@/lib/grades";

type GradeBlock = { avg: number; band: GradeBand };

export function StatsRow({
  current,
  wam,
}: {
  current: GradeBlock | null;
  wam: string | null;
}) {
  const currentLabel =
    current != null
      ? `Current: Grade ${current.band} (${current.avg.toFixed(1)}%)`
      : "Current: —";
  const wamLabel = wam?.trim() ? wam.trim() : "—";

  return (
    <div className="gm-dash-stats gm-dash-stats--subtitle" aria-label="Summary">
      <div className="gm-dash-substat">
        <span className="gm-dash-substat-value gm-dash-substat-value--accent">
          {currentLabel}
        </span>
        <span className="gm-dash-substat-value">{wamLabel}</span>
      </div>
    </div>
  );
}
