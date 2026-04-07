"use client";

import { useEffect, useMemo } from "react";

export type HellWeekAssessment = {
  id: string;
  assessment_name: string;
  weighting: number;
  due_date: string;
  course_code: string;
  course_name: string;
};

type HellWeekCalendarProps = {
  assessments: HellWeekAssessment[];
  semesterStart: string;
  semesterEnd: string;
  onClose: () => void;
};

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfCalendarWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = d / (1 - Math.abs(2 * l - 1) + Number.EPSILON);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v };
  }
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) {
    rp = c;
    gp = x;
  } else if (hh < 120) {
    rp = x;
    gp = c;
  } else if (hh < 180) {
    gp = c;
    bp = x;
  } else if (hh < 240) {
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const t = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}

/** Smooth heat → tint; 0 = transparent. Piecewise HSL interpolation between brand stops. */
function heatToTintColor(heat: number): string {
  if (heat <= 0) return "transparent";

  if (heat > 0 && heat < 1) {
    const { r, g, b } = hexToRgb("#E1F5EE");
    const alpha = 0.12 + heat * 0.55;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const stops: { t: number; hex: string }[] = [
    { t: 1, hex: "#E1F5EE" },
    { t: 15, hex: "#E1F5EE" },
    { t: 16, hex: "#FAEEDA" },
    { t: 30, hex: "#FAEEDA" },
    { t: 31, hex: "#FAC775" },
    { t: 50, hex: "#FAC775" },
    { t: 51, hex: "#F5C4B3" },
    { t: 70, hex: "#F5C4B3" },
    { t: 71, hex: "#F0997B" },
    { t: 200, hex: "#F0997B" },
  ];

  const capped = Math.min(heat, 200);
  let i = 0;
  while (i < stops.length - 1 && !(capped <= stops[i + 1].t)) i++;

  const lo = stops[i];
  const hi = stops[Math.min(i + 1, stops.length - 1)];
  const span = Math.max(1e-6, hi.t - lo.t);
  const u = (capped - lo.t) / span;
  const ra = hexToRgb(lo.hex);
  const rb = hexToRgb(hi.hex);
  const A = rgbToHsl(ra.r, ra.g, ra.b);
  const B = rgbToHsl(rb.r, rb.g, rb.b);
  let dh = B.h - A.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const hh = A.h + dh * u;
  const ss = A.s + (B.s - A.s) * u;
  const ll = A.l + (B.l - A.l) * u;
  const { r, g, b } = hslToRgb(hh, ss, ll);

  return rgbToHex(r, g, b);
}

function truncateName(name: string, max = 20): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max)}…`;
}

function buildWeekRows(semStart: string, semEnd: string): Date[][] {
  const start = parseIsoLocal(semStart);
  const end = parseIsoLocal(semEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const firstMonday = startOfCalendarWeekMonday(start);
  const lastMonday = startOfCalendarWeekMonday(end);
  const weeks: Date[][] = [];
  for (
    let rowStart = new Date(firstMonday);
    rowStart.getTime() <= lastMonday.getTime();
    rowStart.setDate(rowStart.getDate() + 7)
  ) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(rowStart);
      cell.setDate(cell.getDate() + d);
      row.push(cell);
    }
    weeks.push(row);
  }
  return weeks;
}

export default function HellWeekCalendar({
  assessments,
  semesterStart,
  semesterEnd,
  onClose,
}: HellWeekCalendarProps) {
  const hasAnyDueDates = assessments.some((a) => a.due_date);

  const calendarModel = useMemo(() => {
    const weekRows = buildWeekRows(semesterStart, semesterEnd);
    const semStartD = parseIsoLocal(semesterStart);
    const semEndD = parseIsoLocal(semesterEnd);
    const inSemester = (d: Date) =>
      d.getTime() >= semStartD.getTime() && d.getTime() <= semEndD.getTime();

    const byDay = new Map<
      string,
      { heat: number; items: HellWeekAssessment[] }
    >();

    for (const a of assessments) {
      if (!a.due_date) continue;
      const due = parseIsoLocal(a.due_date);
      if (Number.isNaN(due.getTime()) || !inSemester(due)) continue;
      const key = formatIsoLocal(due);
      const w =
        typeof a.weighting === "number" && Number.isFinite(a.weighting)
          ? a.weighting
          : 0;
      const cur = byDay.get(key) ?? { heat: 0, items: [] };
      cur.heat += w;
      cur.items.push(a);
      byDay.set(key, cur);
    }

    const weekModels = weekRows.map((days) => {
      let weekHeat = 0;
      const cells = days.map((d) => {
        const key = formatIsoLocal(d);
        const block = byDay.get(key);
        const dayHeat = block?.heat ?? 0;
        weekHeat += dayHeat;
        const within = inSemester(d);
        return {
          date: d,
          iso: key,
          dayHeat,
          items: block?.items ?? [],
          withinSemester: within,
        };
      });
      return { days: cells, weekHeat };
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = formatIsoLocal(today);

    let scrollWeekMondayIso: string | null = null;
    for (const wm of weekModels) {
      if (wm.days.some((c) => c.iso === todayIso)) {
        scrollWeekMondayIso = wm.days[0]?.iso ?? null;
        break;
      }
    }

    return { weekModels, todayIso, scrollWeekMondayIso };
  }, [assessments, semesterStart, semesterEnd]);

  useEffect(() => {
    const iso = calendarModel.scrollWeekMondayIso;
    if (!iso) return;
    const run = () => {
      const narrow = window.matchMedia("(max-width: 640px)").matches;
      const el = document.getElementById(
        narrow ? `hell-week-m-${iso}` : `hell-week-d-${iso}`,
      );
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [calendarModel.scrollWeekMondayIso]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mono = "var(--font-gm-mono), ui-monospace, monospace";
  const serif = "var(--font-gm-serif), serif";
  const outfit = "var(--font-gm-outfit), var(--font-inter), sans-serif";
  const ink = "#0b1220";
  const inkSecondary = "rgba(15, 23, 42, 0.72)";
  const inkTertiary = "rgba(15, 23, 42, 0.55)";

  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hell-week-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 60,
        fontFamily: outfit,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 1080,
          maxHeight: "min(92vh, 900px)",
          background: "#fff",
          border: "0.5px solid rgba(15, 23, 42, 0.12)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px 14px",
            borderBottom: "0.5px solid rgba(15, 23, 42, 0.12)",
            position: "relative",
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              border: "0.5px solid rgba(15, 23, 42, 0.12)",
              borderRadius: 8,
              background: "#fff",
              fontFamily: mono,
              fontSize: 12,
              padding: "6px 10px",
              cursor: "pointer",
              color: inkSecondary,
            }}
          >
            Close
          </button>
          <h2
            id="hell-week-title"
            style={{
              fontFamily: serif,
              fontSize: 24,
              margin: 0,
              paddingRight: 72,
              color: ink,
            }}
          >
            Hell Weeks
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              color: inkSecondary,
              maxWidth: 560,
            }}
          >
            Assessment load by day and week. Darker means more weight due at once.
          </p>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 18px 20px" }}>
          {!hasAnyDueDates ? (
            <p
              style={{
                margin: 24,
                textAlign: "center",
                color: inkSecondary,
                fontSize: 14,
              }}
            >
              Add due dates to your assessments to see your hell weeks.
            </p>
          ) : (
            <>
              {/* Desktop / tablet grid */}
              <div className="hell-week-cal-desktop">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "4px 76px repeat(7, minmax(0, 1fr))",
                    gap: 0,
                    marginBottom: 4,
                  }}
                >
                  <div />
                  <div />
                  {dayHeaders.map((d) => (
                    <div
                      key={d}
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: inkTertiary,
                        padding: "0 4px 6px",
                        textAlign: "center",
                      }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {calendarModel.weekModels.map((wm) => {
                  const mondayIso = wm.days[0]?.iso ?? "";
                  const barColor = heatToTintColor(wm.weekHeat);
                  const weekLabel =
                    wm.weekHeat > 70
                      ? "HELL WEEK"
                      : wm.weekHeat >= 50
                        ? "HEAVY"
                        : null;
                  const border = "0.5px solid rgba(15, 23, 42, 0.12)";

                  return (
                    <div
                      key={mondayIso}
                      id={`hell-week-d-${mondayIso}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "4px 76px repeat(7, minmax(0, 1fr))",
                        gap: 0,
                        marginBottom: 0,
                        borderTop: border,
                      }}
                    >
                      <div
                        style={{
                          width: 4,
                          minHeight: 56,
                          alignSelf: "stretch",
                          background:
                            wm.weekHeat <= 0
                              ? "rgba(15, 23, 42, 0.12)"
                              : barColor === "transparent"
                                ? "rgba(15, 23, 42, 0.12)"
                                : barColor,
                          borderRight: border,
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          padding: "4px 6px",
                          borderRight: border,
                          background: "rgba(255,255,255,0.65)",
                        }}
                      >
                        {weekLabel ? (
                          <span
                            style={{
                              fontFamily: mono,
                              fontSize: 9,
                              letterSpacing: "0.08em",
                              lineHeight: 1.2,
                              color: wm.weekHeat > 70 ? "#9a3412" : "#b45309",
                            }}
                          >
                            {weekLabel}
                          </span>
                        ) : null}
                      </div>
                      {wm.days.map((cell) => {
                        const isToday = cell.iso === calendarModel.todayIso;
                        const bg = cell.withinSemester
                          ? heatToTintColor(cell.dayHeat)
                          : "#fafafa";
                        return (
                          <div
                            key={cell.iso}
                            style={{
                              minHeight: 72,
                              borderRight: border,
                              borderBottom: border,
                              background:
                                bg === "transparent" ? "#fff" : bg,
                              padding: "4px 5px 6px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              boxShadow: isToday
                                ? "inset 0 0 0 1.5px rgba(15, 23, 42, 0.35)"
                                : undefined,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: mono,
                                fontSize: 11,
                                color: cell.withinSemester
                                  ? inkSecondary
                                  : "#bbb",
                                textDecoration: isToday
                                  ? "underline"
                                  : undefined,
                                textUnderlineOffset: 2,
                              }}
                            >
                              {cell.date.getDate()}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                                flex: 1,
                                minHeight: 0,
                              }}
                            >
                              {cell.items.map((a) => (
                                <div
                                  key={a.id}
                                  title={`${a.assessment_name} — ${a.course_name}`}
                                  style={{
                                    background: "#fff",
                                    border: border,
                                    borderRadius: 8,
                                    padding: "3px 6px",
                                    fontSize: 10,
                                    lineHeight: 1.25,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontFamily: mono,
                                      fontSize: 10,
                                      color: inkSecondary,
                                    }}
                                  >
                                    {a.course_code}{" "}
                                    <span style={{ color: "#b45309" }}>
                                      {Math.round(a.weighting)}%
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontFamily: outfit,
                                      fontSize: 10,
                                      color: ink,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {truncateName(a.assessment_name)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Mobile list */}
              <div className="hell-week-cal-mobile">
                {calendarModel.weekModels.map((wm) => {
                  const mondayIso = wm.days[0]?.iso ?? "";
                  const allItems = wm.days.flatMap((c) => c.items);
                  const weekRangeLabel = `${wm.days[0].date.getDate()} ${wm.days[0].date.toLocaleString("en-AU", { month: "short" })} – ${wm.days[6].date.getDate()} ${wm.days[6].date.toLocaleString("en-AU", { month: "short" })}`;
                  const weekTint = heatToTintColor(wm.weekHeat);
                  const badge =
                    wm.weekHeat > 70
                      ? "HELL WEEK"
                      : wm.weekHeat >= 50
                        ? "HEAVY"
                        : null;

                  return (
                    <div
                      key={`m-${mondayIso}`}
                      id={`hell-week-m-${mondayIso}`}
                      style={{
                        border: "0.5px solid rgba(15, 23, 42, 0.12)",
                        borderRadius: 12,
                        marginBottom: 10,
                        overflow: "hidden",
                        background:
                          weekTint === "transparent" ? "#fff" : weekTint,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderBottom:
                            allItems.length > 0
                              ? "0.5px solid rgba(15, 23, 42, 0.12)"
                              : undefined,
                          background:
                            weekTint === "transparent"
                              ? "#fff"
                              : "rgba(255,255,255,0.55)",
                        }}
                      >
                        <div
                          style={{
                            width: 4,
                            alignSelf: "stretch",
                            minHeight: 24,
                            borderRadius: 2,
                            background:
                              wm.weekHeat <= 0
                                ? "rgba(15, 23, 42, 0.12)"
                                : weekTint,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontFamily: mono,
                              fontSize: 11,
                              color: inkSecondary,
                            }}
                          >
                            {weekRangeLabel}
                          </div>
                        </div>
                        {badge ? (
                          <div
                            style={{
                              fontFamily: mono,
                              fontSize: 9,
                              letterSpacing: "0.05em",
                              color:
                                wm.weekHeat > 70 ? "#9a3412" : "#b45309",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {badge}
                          </div>
                        ) : null}
                      </div>
                      {allItems.length > 0 ? (
                        <div style={{ padding: 8, background: "#fff" }}>
                          {allItems.map((a) => (
                            <div
                              key={a.id}
                              style={{
                                border: "0.5px solid rgba(15, 23, 42, 0.12)",
                                borderRadius: 8,
                                padding: "8px 10px",
                                marginBottom: 6,
                                fontSize: 12,
                                color: ink,
                              }}
                            >
                              <div style={{ fontFamily: mono, fontSize: 11 }}>
                                {a.course_code}{" "}
                                <span style={{ color: "#b45309" }}>
                                  {Math.round(a.weighting)}%
                                </span>
                              </div>
                              <div style={{ marginTop: 2 }}>
                                {truncateName(a.assessment_name)}
                              </div>
                              <div
                                style={{
                                  fontFamily: mono,
                                  fontSize: 10,
                                  color: inkTertiary,
                                  marginTop: 4,
                                }}
                              >
                                Due{" "}
                                {parseIsoLocal(a.due_date).toLocaleDateString(
                                  "en-AU",
                                  {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  },
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
