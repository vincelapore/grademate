"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CourseCard } from "@/components/CourseCard";

type AssessmentPreview = {
  id: string;
  assessment_name: string;
  weighting: number;
  mark: string | null;
  due_date: string | null;
  sub_assessments?: {
    rows: Array<{ name: string; mark: string | null; weight?: number }>;
  } | null;
  is_hurdle?: boolean | null;
  hurdle_threshold?: number | null;
  hurdle_requirements?: string | null;
};

type Enrolment = {
  id: string;
  course_code: string;
  course_name: string;
  credit_points: number;
  target_grade: number | null;
  profile_url: string | null;
  university: string | null;
  hurdle_information?: string | null;
  assessment_results: AssessmentPreview[];
};

function cleanCourseName(courseCode: string, courseName: string): string {
  const raw = courseName?.trim() ?? "";
  if (!raw) return "";
  const suffix = new RegExp(
    `\\s*\\(${courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`,
    "i",
  );
  return raw.replace(suffix, "").trim();
}

/** YYYY-MM-DD → sort key; missing/invalid dates sort last. */
function dueDateSortKey(due: string | null | undefined): number {
  if (due == null || !String(due).trim()) return Number.POSITIVE_INFINITY;
  const m = String(due)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

const MARKER_TIER_COLORS = {
  red: "#e11d48",
  yellow: "#ca8a04",
  green: "#1d9e75",
} as const;

type MarkerTier = keyof typeof MARKER_TIER_COLORS;

function markerTierForPct(pct: number | null): MarkerTier | null {
  if (pct == null || Number.isNaN(pct) || !Number.isFinite(pct)) return null;
  const p = Math.min(100, Math.max(0, pct));
  if (p < 50) return "red";
  if (p < 75) return "yellow";
  return "green";
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0");
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function parseMarkToPercentage(mark: string | null): number | null {
  const s = mark == null ? "" : String(mark).trim();
  if (!s) return null;
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const n = Number(frac[1]);
    const d = Number(frac[2]);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
    const p = (n / d) * 100;
    return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : null;
  }
  const num = Number(s);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, num));
}

function assessmentState(a: AssessmentPreview): {
  status: "empty" | "partial" | "complete";
  achievedContributionPct: number; // in course % points (0..weighting)
  achievedPct: number | null; // 0..100, used for marker colour
} {
  const weight = Math.max(0, Number.isFinite(a.weighting) ? a.weighting : 0);

  const partRows = a.sub_assessments?.rows;
  const hasParts = (partRows?.length ?? 0) > 1;
  if (hasParts) {
    const rows = partRows!;
    const weights = rows.map((r) =>
      typeof r.weight === "number" && Number.isFinite(r.weight) && r.weight > 0
        ? r.weight
        : 0,
    );
    const wSum = weights.reduce((s, w) => s + w, 0);
    const denomAll = wSum > 0 ? wSum : rows.length;

    let any = false;
    let all = true;
    let numer = 0;

    rows.forEach((r, idx) => {
      const pct = parseMarkToPercentage(r.mark);
      if (pct == null) {
        all = false;
        return;
      }
      any = true;
      const share =
        denomAll > 0 ? (wSum > 0 ? weights[idx]! : 1) / denomAll : 0;
      numer += pct * share;
    });

    if (all) {
      const achievedPct = Math.max(0, Math.min(100, numer));
      const achievedContributionPct = (weight * achievedPct) / 100;
      return { status: "complete", achievedContributionPct, achievedPct };
    }
    if (!any) {
      return { status: "empty", achievedContributionPct: 0, achievedPct: null };
    }
    const achieved = weight * (Math.max(0, Math.min(100, numer)) / 100);
    return {
      status: "partial",
      achievedContributionPct: Math.max(0, Math.min(weight, achieved)),
      achievedPct: Math.max(0, Math.min(100, numer)),
    };
  }

  const pct = parseMarkToPercentage(a.mark);
  if (pct == null)
    return { status: "empty", achievedContributionPct: 0, achievedPct: null };
  return {
    status: "complete",
    achievedContributionPct: (weight * pct) / 100,
    achievedPct: pct,
  };
}

/** Word-boundary match so titles like "example" are not treated as exams. */
function isExamAssessmentTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  return /\b(exam|exams|examination)\b/i.test(t);
}

type CourseTabSegment = {
  id: string;
  weighting: number;
  mode: "empty" | "half" | "full";
  tier: MarkerTier | null;
  solidColor: string | null;
  fadedColor: string;
  emptyStroke: string;
  achievedPoints: number;
  achievablePoints: number;
  unachievablePoints: number;
  isExam: boolean;
  startPct: number;
};

type BarLeftPiece = {
  key: string;
  widthPct: number;
  kind: "achieved" | "achievable";
  solidColor: string | null;
  fadedColor: string;
};

type BarRightPiece = {
  key: string;
  widthPct: number;
  kind: "unachievable";
  tint: string;
};

function clampNumber(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function CourseTabPreviewBar({
  segmentsWithPos,
  leftPieces,
  rightPieces,
}: {
  segmentsWithPos: CourseTabSegment[];
  leftPieces: BarLeftPiece[];
  rightPieces: BarRightPiece[];
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [barWidthPx, setBarWidthPx] = useState<number>(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setBarWidthPx(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dotLefts = useMemo(() => {
    if (!segmentsWithPos.length || barWidthPx <= 0) {
      return segmentsWithPos.map((s) => clampNumber(s.startPct, 0, 100));
    }
    const dotWidthPx = 10;
    const minGapPx = 12; // desired visual gap between dot centres
    const minGapPct = (minGapPx / barWidthPx) * 100;
    const dotWidthPct = (dotWidthPx / barWidthPx) * 100;
    const maxLeftPct = clampNumber(100 - dotWidthPct, 0, 100);

    const n = segmentsWithPos.length;

    // First pass: try to respect the natural `startPct` positions while enforcing
    // a minimum gap between dots so they don't visually collide.
    const lefts: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = clampNumber(segmentsWithPos[i]!.startPct, 0, 100);
      const prev = i > 0 ? lefts[i - 1]! : null;
      const next = prev == null ? base : Math.max(base, prev + minGapPct);
      lefts.push(next);
    }

    const last = lefts[lefts.length - 1] ?? 0;

    // If the last dot would overflow the track or the available space cannot
    // honour the minimum visual gap, fall back to evenly-spaced positions.
    const totalRequiredForMinGap = dotWidthPct + (n - 1) * minGapPct;
    if (last > maxLeftPct || totalRequiredForMinGap > 100) {
      if (n === 1) {
        return [
          clampNumber(
            Math.min(segmentsWithPos[0]!.startPct, maxLeftPct),
            0,
            maxLeftPct,
          ),
        ];
      }
      const step = Math.max(dotWidthPct, maxLeftPct / (n - 1));
      const even: number[] = [];
      for (let i = 0; i < n; i++) {
        const pos = clampNumber(i * step, 0, maxLeftPct);
        even.push(pos);
      }
      return even;
    }

    return lefts.map((l) => clampNumber(l, 0, maxLeftPct));
  }, [segmentsWithPos, barWidthPx]);

  return (
    <div
      className="gm-dash-course-tab-weight-bar-wrap"
      aria-hidden
      ref={wrapRef}
    >
      <div className="gm-dash-course-tab-dot-layer">
        {/*
          Match the original dashboard assessment dot styling (stroke weight, fill behaviour,
          and half-fill clip) so these feel consistent with the CourseCard UI.
        */}
        {segmentsWithPos.map((s, idx) => {
          const left = `${dotLefts[idx] ?? 0}%`;
          const clipId = `gm-tab-dot-${s.id}`;
          const fillMode: "empty" | "half" | "full" = s.mode;
          const fill =
            fillMode === "empty" || !s.solidColor ? "none" : s.solidColor;
          const stroke =
            fillMode === "empty"
              ? "var(--gm-assess-dot-empty-stroke, rgba(15, 23, 42, 0.22))"
              : "var(--gm-assess-dot-filled-stroke, rgba(15, 23, 42, 0.06))";
          const sw = fillMode === "empty" ? 1.35 : 0.85;

          return (
            <span
              key={s.id}
              className="gm-dash-course-tab-dot"
              style={{ left }}
            >
              <svg
                width={11}
                height={11}
                viewBox="0 0 10 10"
                aria-hidden
                className="gm-dash-course-tab-dot-svg"
              >
                {fillMode === "half" && fill !== "none" ? (
                  <defs>
                    <clipPath id={clipId}>
                      <rect x="0" y="0" width="5" height="10" />
                    </clipPath>
                  </defs>
                ) : null}

                {s.isExam ? (
                  <>
                    <rect
                      x={1.15}
                      y={1.15}
                      width={7.7}
                      height={7.7}
                      rx={1}
                      ry={1}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={sw}
                    />
                    {fill === "none" ? null : fillMode === "half" ? (
                      <rect
                        x={1.15}
                        y={1.15}
                        width={7.7}
                        height={7.7}
                        rx={1}
                        ry={1}
                        fill={fill}
                        clipPath={`url(#${clipId})`}
                      />
                    ) : (
                      <rect
                        x={1.15}
                        y={1.15}
                        width={7.7}
                        height={7.7}
                        rx={1}
                        ry={1}
                        fill={fill}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <circle
                      cx={5}
                      cy={5}
                      r={3.85}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={sw}
                    />
                    {fill === "none" ? null : fillMode === "half" ? (
                      <circle
                        cx={5}
                        cy={5}
                        r={3.85}
                        fill={fill}
                        clipPath={`url(#${clipId})`}
                      />
                    ) : (
                      <circle cx={5} cy={5} r={3.85} fill={fill} />
                    )}
                  </>
                )}
              </svg>
            </span>
          );
        })}
      </div>

      <div className="gm-dash-course-tab-weight-bar">
        {leftPieces.map((p) => (
          <span
            key={p.key}
            className="gm-dash-course-tab-weight-seg"
            style={{
              width: `${Math.max(0, Math.min(100, p.widthPct))}%`,
              background:
                p.kind === "achieved"
                  ? (p.solidColor ?? "rgba(15, 23, 42, 0.25)")
                  : p.fadedColor,
            }}
          />
        ))}
        {rightPieces.map((p) => (
          <span
            key={p.key}
            className="gm-dash-course-tab-weight-seg gm-dash-course-tab-weight-seg--unachievable"
            style={
              {
                width: `${Math.max(0, Math.min(100, p.widthPct))}%`,
                "--gm-unach-tint": p.tint,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardCourseTabs({
  enrolments,
}: {
  enrolments: Enrolment[];
}) {
  const [localEnrolments, setLocalEnrolments] =
    useState<Enrolment[]>(enrolments);
  const ids = useMemo(
    () => localEnrolments.map((e) => e.id),
    [localEnrolments],
  );
  const [activeId, setActiveId] = useState<string | null>(() => ids[0] ?? null);

  useEffect(() => {
    setLocalEnrolments(enrolments);
  }, [enrolments]);

  useEffect(() => {
    function onMarkChange(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { enrolmentId: string; assessmentId: string; mark: string | null }
        | undefined;
      if (!detail?.enrolmentId || !detail.assessmentId) return;
      setLocalEnrolments((prev) =>
        prev.map((en) => {
          if (en.id !== detail.enrolmentId) return en;
          return {
            ...en,
            assessment_results: (en.assessment_results ?? []).map((a) =>
              a.id === detail.assessmentId ? { ...a, mark: detail.mark } : a,
            ),
          };
        }),
      );
    }

    function onPartsChange(e: Event) {
      const detail = (e as CustomEvent).detail as
        | {
            enrolmentId: string;
            assessmentId: string;
            sub_assessments: {
              rows: Array<{
                name: string;
                mark: string | null;
                weight?: number;
              }>;
            } | null;
          }
        | undefined;
      if (!detail?.enrolmentId || !detail.assessmentId) return;
      setLocalEnrolments((prev) =>
        prev.map((en) => {
          if (en.id !== detail.enrolmentId) return en;
          return {
            ...en,
            assessment_results: (en.assessment_results ?? []).map((a) =>
              a.id === detail.assessmentId
                ? { ...a, sub_assessments: detail.sub_assessments }
                : a,
            ),
          };
        }),
      );
    }

    if (typeof window === "undefined") return;
    window.addEventListener("gm:mark-change", onMarkChange);
    window.addEventListener("gm:parts-change", onPartsChange);
    return () => {
      window.removeEventListener("gm:mark-change", onMarkChange);
      window.removeEventListener("gm:parts-change", onPartsChange);
    };
  }, []);

  const active = useMemo(() => {
    if (!activeId) return localEnrolments[0] ?? null;
    return (
      localEnrolments.find((e) => e.id === activeId) ??
      localEnrolments[0] ??
      null
    );
  }, [activeId, localEnrolments]);

  if (!localEnrolments.length) return null;

  return (
    <section className="gm-dash-course-tabs">
      <div
        className="gm-dash-course-tabs-grid"
        role="tablist"
        aria-label="Courses"
      >
        {localEnrolments.map((e) => {
          const isActive = e.id === (active?.id ?? null);
          const name = cleanCourseName(e.course_code, e.course_name);
          const sorted = [...(e.assessment_results ?? [])].sort((a, b) => {
            const da = dueDateSortKey(a.due_date);
            const db = dueDateSortKey(b.due_date);
            if (da !== db) return da - db;
            return a.assessment_name.localeCompare(b.assessment_name);
          });

          const segments = sorted.map((a) => {
            const state = assessmentState(a);
            const weighting = Math.max(
              0,
              Number.isFinite(a.weighting) ? a.weighting : 0,
            );

            const tier = markerTierForPct(state.achievedPct);
            const solidColor = tier ? MARKER_TIER_COLORS[tier] : "#0f172a";
            const fadedColor = tier
              ? hexToRgba(solidColor, 0.22)
              : "rgba(15, 23, 42, 0.08)";
            const emptyStroke = "rgba(15, 23, 42, 0.22)";

            const achievedPoints = Math.max(
              0,
              Math.min(weighting, state.achievedContributionPct),
            );
            const remaining = Math.max(0, weighting - achievedPoints);
            const achievablePoints =
              state.status === "complete" ? 0 : remaining;
            const unachievablePoints =
              state.status === "complete" ? remaining : 0;

            const mode: "empty" | "half" | "full" =
              state.status === "complete"
                ? "full"
                : state.status === "partial"
                  ? "half"
                  : "empty";

            return {
              id: a.id,
              weighting,
              mode,
              tier,
              solidColor: tier ? solidColor : null,
              fadedColor,
              emptyStroke,
              achievedPoints,
              achievablePoints,
              unachievablePoints,
              isExam: isExamAssessmentTitle(a.assessment_name),
            };
          });

          const barTotal = segments.reduce((s, x) => s + x.weighting, 0);
          let accLeft = 0;
          const segmentsWithPos = segments.map((s) => {
            const startPct = barTotal > 0 ? (accLeft / barTotal) * 100 : 0;
            // Completed assessments only "occupy" achievedPoints on the left;
            // the remainder becomes unachievable and is pushed to the right.
            accLeft += s.achievedPoints + s.achievablePoints;
            return { ...s, startPct };
          });

          const leftPieces: Array<{
            key: string;
            widthPct: number;
            kind: "achieved" | "achievable";
            solidColor: string | null;
            fadedColor: string;
          }> = [];
          let unachievableWidthPct = 0;
          let unachievableTint: string | null = null;

          segmentsWithPos.forEach((s) => {
            const denom = barTotal > 0 ? barTotal : 1;
            if (s.achievedPoints > 0) {
              leftPieces.push({
                key: `${s.id}-ach`,
                widthPct: (s.achievedPoints / denom) * 100,
                kind: "achieved",
                solidColor: s.solidColor,
                fadedColor: s.fadedColor,
              });
            }
            if (s.achievablePoints > 0) {
              leftPieces.push({
                key: `${s.id}-avail`,
                widthPct: (s.achievablePoints / denom) * 100,
                kind: "achievable",
                solidColor: s.solidColor,
                fadedColor: s.fadedColor,
              });
            }
            if (s.unachievablePoints > 0) {
              unachievableWidthPct += (s.unachievablePoints / denom) * 100;
              if (!unachievableTint) {
                unachievableTint = s.solidColor ?? "#0f172a";
              }
            }
          });
          const rightPieces: Array<{
            key: string;
            widthPct: number;
            kind: "unachievable";
            tint: string;
          }> =
            unachievableWidthPct > 0
              ? [
                  {
                    key: "unach",
                    widthPct: unachievableWidthPct,
                    kind: "unachievable",
                    tint: unachievableTint ?? "#0f172a",
                  },
                ]
              : [];
          return (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                isActive
                  ? "gm-dash-course-tab-card gm-dash-course-tab-card--active"
                  : "gm-dash-course-tab-card"
              }
              onClick={() => setActiveId(e.id)}
            >
              <div className="gm-dash-course-tab-top">
                <div className="gm-dash-course-tab-code">{e.course_code}</div>
                <div className="gm-dash-course-tab-name">{name}</div>
              </div>

              <div
                className="gm-dash-course-tab-assess"
                aria-label="Assessments preview"
              >
                {segmentsWithPos.length ? (
                  <>
                    <CourseTabPreviewBar
                      segmentsWithPos={segmentsWithPos}
                      leftPieces={leftPieces}
                      rightPieces={rightPieces}
                    />
                  </>
                ) : (
                  <div className="gm-dash-course-tab-empty">
                    No assessments loaded yet
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="gm-dash-course-tabs-panel" role="tabpanel">
          <CourseCard key={active.id} enrolment={active} />
        </div>
      ) : null}
    </section>
  );
}
