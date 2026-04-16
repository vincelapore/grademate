"use client";

export function DashboardOverallCourseRow({
  courseCode,
  courseName,
  currentAvgPercent,
  overallPercentSoFar,
  targetGrade,
}: {
  courseCode: string;
  courseName: string;
  currentAvgPercent: number | null;
  overallPercentSoFar: number | null;
  targetGrade: number | null;
}) {
  const primary =
    currentAvgPercent != null && Number.isFinite(currentAvgPercent)
      ? `${currentAvgPercent.toFixed(1)}%`
      : "—";
  const secondary =
    overallPercentSoFar != null && Number.isFinite(overallPercentSoFar)
      ? `${overallPercentSoFar.toFixed(1)}%`
      : "—";

  return (
    <div className="gm-dash-overall-course-row">
      <div className="min-w-0">
        <div className="gm-dash-overall-course-code">{courseCode}</div>
        <div className="gm-dash-overall-course-name">{courseName}</div>
      </div>

      <div className="gm-dash-overall-course-grades" aria-label="Grades">
        <div className="gm-dash-overall-course-grade">
          <span className="gm-dash-overall-course-grade-label">Current</span>
          <span className="gm-dash-overall-course-grade-value">{primary}</span>
        </div>
        <div className="gm-dash-overall-course-grade">
          <span className="gm-dash-overall-course-grade-label">Overall</span>
          <span className="gm-dash-overall-course-grade-value">{secondary}</span>
        </div>
        {targetGrade != null ? (
          <div className="gm-dash-overall-course-grade">
            <span className="gm-dash-overall-course-grade-label">Target</span>
            <span className="gm-dash-overall-course-grade-value">
              {targetGrade}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

