"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { GmShell } from "@/components/gm/GmShell";
import {
  calculateRequiredMarkForTarget,
  calculateWeightedTotal,
  GRADE_THRESHOLDS,
  percentToGradeBand,
  parseMarkToPercentage,
  formatMarkDisplay,
  calculateEqualDistributionMarks,
  aggregateSubAssessmentMarks,
  formatAggregateMarkForStorage,
  type GradeBand,
} from "@/lib/grades";
import { isValidMarkInput } from "@/lib/mark-input";
import { ensureSubAssessmentRows } from "@/lib/sub-assessment";
import { Calculator } from "lucide-react";
import { AssessmentCalculatorModal } from "@/components/AssessmentCalculatorModal";
import {
  decodeState,
  encodeState,
  type AppState,
  type CourseState,
  type SubAssessmentRow,
} from "@/lib/state";
import type { CourseAssessment } from "@/lib/qut-scraper";
import {
  getCurrentSemester,
  getSelectableYears,
  type SemesterSelection,
  type SemesterType,
} from "@/lib/semester";
import type { DeliveryModeOption } from "@/lib/delivery-modes";
import {
  parseDueDate,
  formatEventDate,
  generateICal,
  type CalendarEvent,
} from "@/lib/calendar";

const DEFAULT_GOAL: GradeBand = 7;

/** Fire-and-forget analytics event. Matches ANALYTICS_EVENTS in cache-redis (client events only used here). */
function trackAnalytics(event: string): void {
  const secret =
    typeof process.env.NEXT_PUBLIC_ANALYTICS_SECRET === "string"
      ? process.env.NEXT_PUBLIC_ANALYTICS_SECRET
      : "";
  const url = `/api/analytics${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

function HomeContent() {
  const searchParams = useSearchParams();

  const [state, setState] = useState<AppState>({ courses: [] });
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [loadingCourseForDelivery, setLoadingCourseForDelivery] = useState<
    "Internal" | "External" | null
  >(null);
  const [loadingDeliveryModes, setLoadingDeliveryModes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseInput, setCourseInput] = useState("");
  const [semester, setSemester] = useState<{
    year: number;
    semester: SemesterType;
  }>(() => {
    const current = getCurrentSemester();
    return { year: current.year, semester: current.semester };
  });
  const [pendingCourse, setPendingCourse] = useState<{
    courseCode: string;
    year: number;
    semester: SemesterType;
    deliveryModes: DeliveryModeOption[];
  } | null>(null);
  const [calendarPopup, setCalendarPopup] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [markHelpOpen, setMarkHelpOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [calendarEventSelection, setCalendarEventSelection] = useState<
    boolean[]
  >([]);
  const [hurdlePopup, setHurdlePopup] = useState<{
    courseIdx: number;
    itemIdx: number;
  } | null>(null);
  const [assessmentCalculatorPopup, setAssessmentCalculatorPopup] = useState<{
    courseIdx: number;
    itemIdx: number;
  } | null>(null);
  const [showSemesterChangedBanner, setShowSemesterChangedBanner] =
    useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Once a course exists, semester/year is fixed to that course's semester
  const effectiveSemester = useMemo(() => {
    if (state.courses.length > 0 && state.defaultSemester) {
      return {
        year: state.defaultSemester.year,
        semester: state.defaultSemester.semester,
      };
    }
    return semester;
  }, [state.courses.length, state.defaultSemester, semester]);

  // Calendar popup: compute events for the open course so we can manage selection
  const calendarPopupEvents = useMemo(() => {
    if (calendarPopup == null) return null;
    const course = state.courses[calendarPopup];
    if (!course) return null;
    const allEvents: CalendarEvent[] = [];
    course.course.items.forEach((item) => {
      if (item.dueDate) {
        const events = parseDueDate(item.dueDate);
        events.forEach((event) => {
          allEvents.push({
            ...event,
            title: `${course.course.courseCode}: ${item.name}${event.title && event.title !== item.name ? ` - ${event.title}` : ""}`,
          });
        });
      }
    });
    allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    return allEvents;
  }, [calendarPopup, state.courses]);

  // When calendar popup opens or events change, default to all selected.
  // Intentionally omit calendarEventSelection from deps to avoid resetting when user toggles checkboxes.
  useEffect(() => {
    if (
      calendarPopupEvents &&
      calendarEventSelection.length !== calendarPopupEvents.length
    ) {
      setCalendarEventSelection(calendarPopupEvents.map(() => true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when popup/events change, not on selection toggle
  }, [calendarPopup, calendarPopupEvents]);

  const STORAGE_KEY = "qutgrades-state";

  // Hydrate on first load: shared link (URL) overrides, otherwise use localStorage
  useEffect(() => {
    if (isHydrated) return;
    const encodedFromUrl = searchParams.get("data");
    const fromUrl = decodeState(encodedFromUrl);
    if (fromUrl?.courses?.length) {
      setState(fromUrl);
      if (fromUrl.defaultSemester) {
        setSemester({
          year: fromUrl.defaultSemester.year,
          semester: fromUrl.defaultSemester.semester,
        });
      }
    } else {
      try {
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(STORAGE_KEY)
            : null;
        const decoded = decodeState(stored);
        if (decoded) {
          setState(decoded);
          if (decoded.defaultSemester) {
            setSemester({
              year: decoded.defaultSemester.year,
              semester: decoded.defaultSemester.semester,
            });
          }
        }
      } catch {
        // ignore localStorage errors
      }
    }
    setIsHydrated(true);
  }, [searchParams, isHydrated]);

  // Persist to localStorage (debounced)
  const STORAGE_DEBOUNCE_MS = 400;
  useEffect(() => {
    if (!isHydrated) return;
    const id = window.setTimeout(() => {
      try {
        const encoded = encodeState(stateRef.current);
        if (typeof window !== "undefined" && window.localStorage) {
          if (encoded) window.localStorage.setItem(STORAGE_KEY, encoded);
          else window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }, STORAGE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [state, isHydrated]);

  // When tab becomes visible, check if "current" semester has changed; refresh picker or show banner.
  useEffect(() => {
    const handler = () => {
      const current = getCurrentSemester();
      const effective =
        state.courses.length > 0 && state.defaultSemester
          ? {
              year: state.defaultSemester.year,
              semester: state.defaultSemester.semester,
            }
          : semester;
      if (
        current.year !== effective.year ||
        current.semester !== effective.semester
      ) {
        if (state.courses.length === 0) {
          setSemester({
            year: current.year,
            semester: current.semester,
          });
        } else {
          setShowSemesterChangedBanner(true);
        }
      }
    };
    if (typeof window === "undefined") return;
    window.addEventListener("visibilitychange", handler);
    return () => window.removeEventListener("visibilitychange", handler);
  }, [state.courses.length, state.defaultSemester, semester]);

  const findDeliveryModes = useCallback(
    async (codeRaw: string) => {
      const code = codeRaw.trim().toUpperCase();
      if (!code) return;
      setError(null);
      setLoadingDeliveryModes(true);
      try {
        const params = new URLSearchParams({
          courseCode: code,
          year: effectiveSemester.year.toString(),
          semester: effectiveSemester.semester,
          university: "qut",
        });
        const res = await fetch(`/api/delivery-modes?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to find unit ${code}`);
        }
        const data = await res.json();
        setPendingCourse({
          courseCode: code,
          year: effectiveSemester.year,
          semester: effectiveSemester.semester,
          deliveryModes: data.modes,
        });
        setCourseInput("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to find unit.");
      } finally {
        setLoadingDeliveryModes(false);
      }
    },
    [effectiveSemester],
  );

  const addCourse = useCallback(
    async (deliveryMode: DeliveryModeOption) => {
      if (!pendingCourse) return;
      setError(null);
      setLoadingCourse(true);
      setLoadingCourseForDelivery(deliveryMode.delivery);
      try {
        const params = new URLSearchParams({
          courseCode: pendingCourse.courseCode,
          year: pendingCourse.year.toString(),
          semester: pendingCourse.semester,
          delivery: deliveryMode.delivery,
          university: "qut",
        });
        const res = await fetch(`/api/scrape?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Failed to load unit ${pendingCourse.courseCode}`,
          );
        }
        const course = (await res.json()) as CourseAssessment;
        const marks = course.items.map(() => null);
        const fullSemester: SemesterSelection = {
          year: pendingCourse.year,
          semester: pendingCourse.semester,
          delivery: deliveryMode.delivery,
        };
        const courseState: CourseState = {
          course,
          marks,
          goalGrade: DEFAULT_GOAL,
          semester: fullSemester,
        };
        setState((prev) => ({
          ...prev,
          courses: [...prev.courses, courseState],
          defaultSemester: fullSemester,
        }));
        setPendingCourse(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load unit.");
      } finally {
        setLoadingCourse(false);
        setLoadingCourseForDelivery(null);
      }
    },
    [pendingCourse],
  );

  const updateMark = useCallback(
    (courseIndex: number, itemIndex: number, value: string) => {
      const trimmed = value.trim();
      const markValue = trimmed === "" ? null : trimmed;

      if (markValue != null && !isValidMarkInput(markValue)) {
        return;
      }

      setState((prev) => {
        const courses = [...prev.courses];
        const course = { ...courses[courseIndex] };
        const marks = [...course.marks];
        marks[itemIndex] = markValue;
        course.marks = marks;
        courses[courseIndex] = course;
        return { ...prev, courses };
      });
    },
    [],
  );

  const updateSubAssessmentRows = useCallback(
    (courseIndex: number, itemIndex: number, rows: SubAssessmentRow[]) => {
      setState((prev) => {
        const courses = [...prev.courses];
        const course = { ...courses[courseIndex] };
        const sub = { ...(course.subAssessments ?? {}) };
        sub[itemIndex] = { rows };
        course.subAssessments = sub;
        courses[courseIndex] = course;
        return { ...prev, courses };
      });
    },
    [],
  );

  const applySubAssessmentRows = useCallback(
    (courseIndex: number, itemIndex: number, rows: SubAssessmentRow[]) => {
      updateSubAssessmentRows(courseIndex, itemIndex, rows);
      const agg = aggregateSubAssessmentMarks(
        rows.map((r) => ({
          mark: r.mark,
          weight:
            typeof r.weight === "number" && !Number.isNaN(r.weight)
              ? r.weight
              : 0,
        })),
      );
      if (agg != null) {
        const s = formatAggregateMarkForStorage(agg);
        if (s) updateMark(courseIndex, itemIndex, s);
      }
    },
    [updateMark, updateSubAssessmentRows],
  );

  const updateGoal = useCallback((courseIndex: number, goal: GradeBand) => {
    setState((prev) => {
      const courses = [...prev.courses];
      const course = { ...courses[courseIndex], goalGrade: goal };
      courses[courseIndex] = course;
      return { ...prev, courses };
    });
  }, []);

  const removeCourse = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      courses: prev.courses.filter((_, i) => i !== index),
    }));
    trackAnalytics("remove_course");
  }, []);

  const copyLink = useCallback(async () => {
    try {
      const encoded = encodeState(stateRef.current);
      const url = encoded
        ? `${window.location.origin}/university/qut?data=${encoded}`
        : window.location.origin + "/university/qut";
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      trackAnalytics("copy_link");
    } catch {
      setError("Could not copy link.");
    }
  }, []);

  const handleReset = useCallback(() => {
    const current = getCurrentSemester();
    setState({ courses: [] });
    setPendingCourse(null);
    setSemester({ year: current.year, semester: current.semester });
    setShowResetConfirm(false);
    setError(null);
    trackAnalytics("reset_confirmed");
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const dashboardSummary = useMemo(() => {
    if (!state.courses.length) return null;

    // Calculate overall (includes unmarked as 0)
    const totals = state.courses.map((c) =>
      calculateWeightedTotal(
        c.course.items.map((it, idx) => ({
          weight: it.weight,
          mark: c.marks[idx] ?? null,
        })),
      ),
    );
    const overallAvg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const overallBand = percentToGradeBand(overallAvg);

    // Calculate current grade (only assessments with marks)
    const currentGrades = state.courses
      .map((c) => {
        let markedSum = 0;
        let markedWeightSum = 0;

        c.course.items.forEach((it, idx) => {
          if (it.weight === "pass/fail") return;
          const mark = c.marks[idx];
          const percentage = parseMarkToPercentage(mark);

          if (percentage != null && !Number.isNaN(percentage)) {
            const weight = typeof it.weight === "number" ? it.weight : 0;
            markedSum += (percentage * weight) / 100;
            markedWeightSum += weight;
          }
        });

        // Return null if no marked assessments
        if (markedWeightSum === 0) return null;

        // Calculate percentage: (sum of marked marks) / (sum of marked weights) * 100
        return (markedSum / markedWeightSum) * 100;
      })
      .filter((g): g is number => g !== null);

    const currentAvg =
      currentGrades.length > 0
        ? currentGrades.reduce((a, b) => a + b, 0) / currentGrades.length
        : null;

    return {
      overall: { avg: overallAvg, band: overallBand },
      current:
        currentAvg != null
          ? { avg: currentAvg, band: percentToGradeBand(currentAvg) }
          : null,
    };
  }, [state.courses]);

  return (
    <div className="gm-univ-page min-h-screen">
      <main
        className="gm-container flex flex-col gap-10 pb-16 pt-4"
        style={{ maxWidth: 1120 }}
      >
        {showSemesterChangedBanner && (
          <div className="gm-univ-warn-banner px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>Semester has changed. Reset to use the new default?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSemesterChangedBanner(false);
                }}
                className="gm-univ-btn-ghost px-3 py-1.5 text-xs"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSemesterChangedBanner(false);
                  handleReset();
                }}
                className="rounded border border-[rgba(186,117,23,0.45)] bg-[rgba(239,159,39,0.15)] px-3 py-1.5 text-xs font-medium text-[#7a4a0f] hover:bg-[rgba(239,159,39,0.22)]"
              >
                Reset
              </button>
            </div>
          </div>
        )}
        <header className="flex flex-col gap-5 border-b gm-univ-border pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="relative min-w-0">
            <h1 className="text-2xl font-bold tracking-tight gm-univ-fg sm:text-4xl">
              QUT Grades
            </h1>
            <p className="mt-1 text-sm gm-univ-muted max-w-md">
              Track your semester progress, calculate grades, and see what you
              need to hit that 7 (or 4).{" "}
              <button
                type="button"
                onClick={() => {
                  setHowToOpen(true);
                  trackAnalytics("how_to_opened");
                }}
                className="gm-univ-muted underline underline-offset-2 transition-colors gm-univ-hover-fg"
              >
                How to use
              </button>
            </p>
            {howToOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center gm-univ-modal-overlay backdrop-blur-sm p-4"
                onClick={() => setHowToOpen(false)}
                role="dialog"
                aria-labelledby="how-to-title"
                aria-modal="true"
              >
                <div
                  className="relative gm-univ-modal w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setHowToOpen(false)}
                    aria-label="Close"
                    className="absolute right-4 top-4 rounded-lg p-1.5 gm-univ-muted transition-all gm-univ-hover-surface gm-univ-hover-fg"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  <div className="space-y-4">
                    <div>
                      <h2
                        id="how-to-title"
                        className="text-xl font-bold tracking-tight gm-univ-fg"
                      >
                        How to use
                      </h2>
                    </div>

                    <div className="space-y-3 text-sm gm-univ-body">
                      <div>
                        <p className="font-semibold gm-univ-fg">
                          1. Add a unit
                        </p>
                        <p className="mt-1 gm-univ-muted-strong">
                          Choose semester and year, enter the unit code (e.g.{" "}
                          <span className="font-mono">IFN666</span>
                          ), and click Find.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold gm-univ-fg">
                          2. Enter marks
                        </p>
                        <p className="mt-1 gm-univ-muted-strong">
                          Type your result for each assessment (e.g.{" "}
                          <span className="font-mono">8/10</span>,{" "}
                          <span className="font-mono">85</span>, or{" "}
                          <span className="font-mono">17/20</span>
                          ). Your current and overall grade update as you go.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold gm-univ-fg">
                          3. See what you need
                        </p>
                        <p className="mt-1 gm-univ-muted-strong">
                          Use the &quot;Need X%&quot; column to see the mark
                          required on remaining items to reach your target grade
                          (default is 7).
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold gm-univ-fg">
                          4. Save or share
                        </p>
                        <p className="mt-1 gm-univ-muted-strong">
                          Your progress is saved automatically in this browser.
                          Use Copy link to share your grades with someone else.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold gm-univ-fg">5. Calendar</p>
                        <p className="mt-1 gm-univ-muted-strong">
                          Open Calendar on a course to choose which due-date
                          events to include, then Export to Calendar to download
                          an .ics file.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold gm-univ-fg">
                          6. Start over
                        </p>
                        <p className="mt-1 gm-univ-muted-strong">
                          Use Reset to clear all courses and marks.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
            {state.courses.length > 0 && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="gm-univ-btn-ghost min-h-[44px] px-4 py-2.5 sm:min-h-0 sm:py-2 gm-univ-danger"
              >
                Reset
              </button>
            )}
            <button
              onClick={copyLink}
              className="gm-univ-btn-ghost min-h-[44px] px-4 py-2.5 sm:min-h-0 sm:py-2"
            >
              {linkCopied ? "Copied!" : "Copy link"}
            </button>
            <a
              href="https://buymeacoffee.com/vincelapore"
              target="_blank"
              rel="noopener noreferrer"
              className="gm-univ-btn-ghost inline-flex min-h-[44px] items-center px-4 py-2.5 sm:min-h-0 sm:py-2"
            >
              Buy Me a Coffee ☕
            </a>
          </div>
        </header>

        {showResetConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center gm-univ-modal-overlay backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
          >
            <div
              className="mx-4 w-full max-w-sm rounded-xl border gm-univ-border-strong gm-univ-surface-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="reset-dialog-title"
                className="text-lg font-semibold gm-univ-fg"
              >
                Reset everything?
              </h2>
              <p className="mt-2 text-sm gm-univ-muted">
                This will remove all courses and marks. You can&apos;t undo
                this.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="gm-univ-btn-ghost flex-1 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="gm-univ-panel grid gap-6 p-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:p-8">
          <div className="min-w-0 space-y-4">
            {!pendingCourse ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {state.courses.length > 0 ? (
                    <div className="col-span-2 flex items-center gap-2 gm-univ-panel-inset px-3 py-2 text-xs font-medium gm-univ-muted-strong">
                      <span>
                        {effectiveSemester.semester} {effectiveSemester.year}
                      </span>
                    </div>
                  ) : (
                    <>
                      <select
                        value={semester.year}
                        onChange={(e) =>
                          setSemester((prev) => ({
                            ...prev,
                            year: parseInt(e.target.value, 10),
                          }))
                        }
                        className="gm-univ-input px-3 py-2 text-xs font-medium"
                      >
                        {getSelectableYears().map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <select
                        value={semester.semester}
                        onChange={(e) =>
                          setSemester((prev) => ({
                            ...prev,
                            semester: e.target.value as SemesterType,
                          }))
                        }
                        className="gm-univ-input px-3 py-2 text-xs font-medium"
                      >
                        <option value="Semester 1">Sem 1</option>
                        <option value="Semester 2">Sem 2</option>
                        <option value="Summer">Summer</option>
                      </select>
                    </>
                  )}
                </div>

                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-3 w-full">
                  <input
                    value={courseInput}
                    onChange={(e) =>
                      setCourseInput(e.target.value.toUpperCase())
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void findDeliveryModes(courseInput);
                      }
                    }}
                    placeholder="Unit code (e.g. IFN666)"
                    className="gm-univ-input min-w-0 flex-1 basis-0 px-4 py-2.5 text-sm font-medium placeholder:text-[rgba(15,23,42,0.45)] sm:basis-auto"
                  />
                  <button
                    disabled={loadingDeliveryModes}
                    onClick={() => void findDeliveryModes(courseInput)}
                    className="gm-univ-btn-primary inline-flex w-full min-w-0 shrink-0 items-center justify-center gap-2 px-5 py-2.5 sm:w-auto sm:min-w-[90px]"
                  >
                    {loadingDeliveryModes ? (
                      <>
                        <span
                          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden
                        />
                        Finding…
                      </>
                    ) : (
                      "Find"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border gm-univ-border gm-univ-surface p-3">
                  <p className="text-xs font-medium gm-univ-muted mb-1">
                    {pendingCourse.courseCode} - {pendingCourse.semester}{" "}
                    {pendingCourse.year}
                  </p>
                  <p className="text-sm font-semibold gm-univ-muted-strong">
                    Select delivery mode:
                  </p>
                </div>
                <div className="space-y-2">
                  {pendingCourse.deliveryModes.map((mode, idx) => {
                    const isLoading =
                      loadingCourse &&
                      loadingCourseForDelivery === mode.delivery;
                    return (
                      <button
                        key={idx}
                        disabled={loadingCourse}
                        onClick={() => void addCourse(mode)}
                        className="gm-univ-btn-ghost w-full justify-start px-4 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            {isLoading && (
                              <span
                                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[rgba(15,23,42,0.15)] border-t-[var(--gm-accent)]"
                                aria-hidden
                              />
                            )}
                            <span>{mode.delivery}</span>
                          </span>
                          {mode.location && (
                            <span className="shrink-0 text-xs gm-univ-muted">
                              {mode.location}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPendingCourse(null)}
                  className="gm-univ-btn-ghost w-full px-4 py-2 text-xs"
                >
                  Cancel
                </button>
              </div>
            )}
            {error && (
              <p className="text-xs font-medium text-red-600">{error}</p>
            )}
          </div>

          <div className="gm-univ-panel-inset min-w-0 overflow-hidden p-6">
            {dashboardSummary ? (
              <div className="space-y-4">
                {dashboardSummary.current && (
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider gm-univ-muted mb-2">
                      Current Grade
                    </p>
                    <p className="text-2xl font-bold tracking-tight gm-univ-fg">
                      <span className="inline-block gm-univ-accent-text">
                        {dashboardSummary.current.avg.toFixed(1)}%
                      </span>
                      <span className="gm-univ-muted ml-3 font-semibold">
                        Grade {dashboardSummary.current.band}
                      </span>
                    </p>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider gm-univ-muted mb-2">
                    Overall
                  </p>
                  <p className="text-2xl font-bold tracking-tight gm-univ-fg">
                    <span className="inline-block gm-univ-accent-text">
                      {dashboardSummary.overall.avg.toFixed(1)}%
                    </span>
                    <span className="gm-univ-muted ml-3 font-semibold">
                      Grade {dashboardSummary.overall.band}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center text-sm gm-univ-muted">
                Add a unit to get started
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {state.courses.map((c, idx) => {
            const weightedItems = c.course.items.map((it, i) => ({
              weight: it.weight,
              mark: c.marks[i] ?? null, // Will be parsed in calculateWeightedTotal
            }));
            const total = calculateWeightedTotal(weightedItems);
            const band = percentToGradeBand(total);
            const goalTarget = GRADE_THRESHOLDS[c.goalGrade];

            // Debug: verify maxPossibleTotal matches total when all assessments have marks
            // (This will be calculated below)

            // Calculate equal distribution filler marks for all uncompleted assessments
            const fillerMarks = calculateEqualDistributionMarks(
              weightedItems,
              goalTarget,
            );

            // Find the last non-pass/fail assessment for "needed on final" calculation
            let lastIndex = -1;
            for (let i = c.course.items.length - 1; i >= 0; i--) {
              if (c.course.items[i].weight !== "pass/fail") {
                lastIndex = i;
                break;
              }
            }

            const neededOnFinal =
              lastIndex >= 0
                ? calculateRequiredMarkForTarget(
                    weightedItems,
                    goalTarget,
                    lastIndex,
                  )
                : null;

            // Check if any marks have been entered
            const hasEnteredMarks = c.marks.some((mark) => {
              const parsed = parseMarkToPercentage(mark);
              return parsed != null && !Number.isNaN(parsed);
            });

            // Calculate maximum possible total assuming 100% on all empty assessments
            // For assessments with marks: use (mark percentage * weight) / 100
            // For empty assessments: assume 100% so add full weight
            let maxPossibleTotal = 0;
            let hasEmptyAssessments = false;
            c.course.items.forEach((item, i) => {
              if (item.weight === "pass/fail") return;
              if (typeof item.weight !== "number") return;

              const mark = c.marks[i];
              const markPercentage = parseMarkToPercentage(mark);

              if (markPercentage != null && !Number.isNaN(markPercentage)) {
                // Has a mark: add (mark percentage * weight) / 100
                maxPossibleTotal += (markPercentage * item.weight) / 100;
              } else {
                // Empty: assume 100%, so add full weight
                maxPossibleTotal += item.weight;
                hasEmptyAssessments = true;
              }
            });

            // When all assessments have marks, maxPossibleTotal should equal total
            // (allowing for floating point precision differences)
            if (
              !hasEmptyAssessments &&
              Math.abs(maxPossibleTotal - total) > 0.01
            ) {
              console.warn(
                `Calculation mismatch: total=${total}, maxPossibleTotal=${maxPossibleTotal}`,
              );
            }

            // Check if goal grade is achievable
            // Goal is unachievable if max possible total (assuming 100% on all empty) < goal threshold
            const isGoalAchievable =
              !hasEnteredMarks || // If no marks entered, assume achievable
              maxPossibleTotal >= goalTarget;

            // Highest achievable grade if they get 100% on all remaining
            const highestAchievableGrade = percentToGradeBand(maxPossibleTotal);

            // Also check if neededOnFinal is >= 100 (for display purposes)
            const requiresPerfectScore =
              hasEnteredMarks && neededOnFinal != null && neededOnFinal >= 100;

            return (
              <article
                key={c.course.courseCode + idx}
                className="group gm-univ-course-card transition-shadow hover:shadow-md sm:p-8"
              >
                <div className="mb-6 flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 gap-y-2">
                      <div>
                        <h2 className="text-xl font-bold tracking-tight gm-univ-fg">
                          {c.course.courseCode}
                          {(() => {
                            const raw = c.course.title?.trim() ?? "";
                            const cleaned = raw
                              .replace(
                                new RegExp(
                                  `\\s*\\(${c.course.courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`,
                                  "i",
                                ),
                                "",
                              )
                              .trim();
                            return cleaned ? ": " + cleaned : "";
                          })()}
                        </h2>
                      </div>
                      {c.course.courseProfileUrl && (
                        <a
                          href={`${c.course.courseProfileUrl}#assessment`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gm-univ-btn-ghost inline-flex items-center p-1.5"
                          title="View course profile"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setCalendarPopup(idx);
                          trackAnalytics("calendar_popup_opened");
                        }}
                        className="gm-univ-btn-ghost inline-flex shrink-0 items-center px-2.5 py-1.5 text-xs"
                        title="Save to calendar"
                      >
                        <svg
                          className="h-3.5 w-3.5 mr-1.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        Calendar
                      </button>
                    </div>
                    <p className="mt-2 text-sm">
                      <span className="font-bold gm-univ-accent-text">
                        {total.toFixed(1)}%
                      </span>
                      <span className="gm-univ-muted ml-2 font-medium">
                        Grade {band}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => removeCourse(idx)}
                    className="gm-univ-btn-ghost shrink-0 px-3 py-1.5 text-xs gm-univ-danger"
                  >
                    Remove
                  </button>
                </div>

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full gm-univ-surface backdrop-blur-sm">
                      <div
                        className="gm-univ-progress-fill"
                        style={{
                          width: `${Math.min(100, total)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm sm:mt-0">
                    <select
                      value={c.goalGrade}
                      onChange={(e) =>
                        updateGoal(idx, Number(e.target.value) as GradeBand)
                      }
                      className="gm-univ-input px-3 py-1.5 text-xs font-semibold gm-univ-muted-strong"
                    >
                      {[4, 5, 6, 7].map((g) => (
                        <option key={g} value={g}>
                          Grade {g}
                        </option>
                      ))}
                    </select>
                    {hasEnteredMarks && (
                      <>
                        {isGoalAchievable ? (
                          neededOnFinal != null && !requiresPerfectScore ? (
                            <span className="gm-univ-muted">
                              Need{" "}
                              <span className="font-bold gm-univ-accent-text">
                                {neededOnFinal.toFixed(1)}%
                              </span>{" "}
                              on final
                            </span>
                          ) : (
                            <span className="gm-univ-muted">
                              Grade {c.goalGrade} achievable
                            </span>
                          )
                        ) : (
                          <span className="text-red-600">
                            <span className="font-bold">
                              Grade {c.goalGrade} not achievable
                            </span>
                            {highestAchievableGrade != null &&
                              highestAchievableGrade < c.goalGrade && (
                                <span className="ml-2 text-xs font-medium">
                                  (Max: Grade {highestAchievableGrade})
                                </span>
                              )}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border gm-univ-border bg-[rgba(15,23,42,0.03)] backdrop-blur-sm">
                  <table className="min-w-full gm-univ-table min-w-full text-xs text-xs">
                    <thead className="gm-univ-surface">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider gm-univ-muted">
                          Assessment
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider gm-univ-muted">
                          Weight
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider gm-univ-muted">
                          Due
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider gm-univ-muted">
                          <span className="inline-flex items-center gap-1.5">
                            Mark
                            <button
                              type="button"
                              onClick={() => {
                                setMarkHelpOpen(true);
                                trackAnalytics("mark_help_opened");
                              }}
                              className="rounded p-0.5 gm-univ-muted transition-colors gm-univ-hover-muted-strong focus:outline-none focus:ring-2 focus:ring-2 focus:ring-[rgba(29,158,117,0.3)]"
                              aria-label="Mark input help"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </button>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(15,23,42,0.08)]">
                      {c.course.items.map((item, i) => {
                        const isPassFail = item.weight === "pass/fail";

                        return (
                          <tr
                            key={item.name + i}
                            className="gm-univ-hover-surface-white/70"
                          >
                            <td className="px-4 py-3 align-middle">
                              <div className="flex items-center gap-2 max-w-xs flex-wrap">
                                <div className="text-sm font-semibold gm-univ-fg">
                                  {item.name}
                                </div>
                                {!isPassFail && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const course = state.courses[idx];
                                      const assessmentCourseWeight =
                                        typeof item.weight === "number"
                                          ? item.weight
                                          : 0;
                                      const raw =
                                        course?.subAssessments?.[i]?.rows;
                                      const normalized =
                                        ensureSubAssessmentRows(
                                          raw?.length
                                            ? raw.map((r) => ({
                                                name: r.name,
                                                mark: r.mark,
                                                weight: (
                                                  r as {
                                                    weight?: number;
                                                  }
                                                ).weight,
                                              }))
                                            : [
                                                {
                                                  name: "Part 1",
                                                  mark: null,
                                                },
                                              ],
                                          assessmentCourseWeight,
                                        );
                                      updateSubAssessmentRows(
                                        idx,
                                        i,
                                        normalized,
                                      );
                                      setAssessmentCalculatorPopup({
                                        courseIdx: idx,
                                        itemIdx: i,
                                      });
                                      trackAnalytics(
                                        "assessment_calculator_opened",
                                      );
                                    }}
                                    className="inline-flex shrink-0 items-center rounded-md border border-[rgba(15,23,42,0.12)] gm-univ-surface p-1 gm-univ-muted transition-colors hover:border-[var(--gm-accent)] hover:bg-[var(--gm-accent-soft)] hover:text-[var(--gm-accent)]"
                                    title="Calculator for this assessment"
                                    aria-label="Open assessment calculator"
                                  >
                                    <Calculator
                                      className="h-3.5 w-3.5"
                                      strokeWidth={1.5}
                                      aria-hidden
                                    />
                                  </button>
                                )}
                                {(item.isHurdle ||
                                  item.hurdleRequirements ||
                                  item.hurdleThreshold != null) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHurdlePopup({
                                        courseIdx: idx,
                                        itemIdx: i,
                                      });
                                      trackAnalytics("hurdle_clicked");
                                    }}
                                    className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-400 transition-colors hover:border-amber-500/60 hover:bg-amber-500/20"
                                    title="Hurdle requirement"
                                  >
                                    Hurdle
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right align-middle">
                              {isPassFail ? (
                                <span className="text-xs font-semibold text-amber-400">
                                  Pass/fail
                                </span>
                              ) : (
                                <span className="font-semibold gm-univ-body">
                                  {typeof item.weight === "number"
                                    ? item.weight.toFixed(0)
                                    : "0"}
                                  %
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right align-middle gm-univ-muted text-xs">
                              {item.dueDate ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right align-middle">
                              {isPassFail ? (
                                <span className="text-xs gm-univ-muted">
                                  Pass
                                </span>
                              ) : (
                                (() => {
                                  const handleMarkChange = (value: string) => {
                                    const trimmed = value.trim();
                                    if (trimmed === "") {
                                      updateMark(idx, i, "");
                                      return;
                                    }
                                    // Store what they typed (including "/XX")
                                    updateMark(idx, i, trimmed);
                                  };
                                  return (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="relative">
                                        {!c.marks[i] &&
                                        fillerMarks[i] != null ? (
                                          <input
                                            type="text"
                                            placeholder={fillerMarks[
                                              i
                                            ]!.toFixed(0)}
                                            value=""
                                            onChange={(e) =>
                                              handleMarkChange(e.target.value)
                                            }
                                            className="w-28 rounded-lg border gm-univ-border-strong gm-univ-surface px-3 py-1.5 pr-14 text-right text-sm font-semibold gm-univ-fg outline-none backdrop-blur-sm placeholder:text-[rgba(15,23,42,0.35)] transition-all focus:ring-2 focus:ring-2 focus:ring-[rgba(29,158,117,0.3)] focus:border-[var(--gm-accent)] focus:bg-white/90"
                                          />
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="e.g. 8/10 or 50"
                                            value={c.marks[i] ?? ""}
                                            onChange={(e) =>
                                              handleMarkChange(e.target.value)
                                            }
                                            className="w-28 rounded-lg border gm-univ-border-strong gm-univ-surface px-3 py-1.5 text-right text-sm font-semibold gm-univ-fg outline-none backdrop-blur-sm placeholder:text-[rgba(15,23,42,0.45)] transition-all focus:ring-2 focus:ring-2 focus:ring-[rgba(29,158,117,0.3)] focus:border-[var(--gm-accent)] focus:bg-white/90"
                                          />
                                        )}
                                      </div>
                                      {(() => {
                                        // Check if mark is "/XX" format - show required "NN/XX (percentage%)" for goal in green
                                        const slashOnly = c.marks[i]
                                          ?.toString()
                                          .trim()
                                          .match(/^\/(\d+)$/);
                                        if (slashOnly) {
                                          const denom = parseInt(
                                            slashOnly[1],
                                            10,
                                          );
                                          // Use required % on this assessment to reach goal (same as "Need X% on final")
                                          const requiredPct = fillerMarks[i];
                                          if (requiredPct == null) {
                                            return (
                                              <span className="text-xs font-semibold gm-univ-accent-text">
                                                —
                                              </span>
                                            );
                                          }
                                          // Smallest mark (nn) such that nn/denom >= requiredPct% (no rounding)
                                          const nn = Math.min(
                                            denom,
                                            Math.ceil(
                                              (requiredPct * denom) / 100,
                                            ),
                                          );
                                          const actualPct = (nn / denom) * 100;
                                          return (
                                            <span className="text-xs font-semibold gm-univ-accent-text">
                                              {nn}/{denom}{" "}
                                              {actualPct >= 100
                                                ? "100"
                                                : actualPct <= 0
                                                  ? "0"
                                                  : actualPct.toFixed(1)}
                                              %
                                            </span>
                                          );
                                        }

                                        const displayMark =
                                          c.marks[i] ?? fillerMarks[i];
                                        const { percentage } =
                                          formatMarkDisplay(displayMark);
                                        if (percentage == null) return null;

                                        return (
                                          <span
                                            className={`text-xs font-semibold ${!c.marks[i] && fillerMarks[i] != null ? "gm-univ-accent-text" : "gm-univ-muted"}`}
                                          >
                                            {percentage.toFixed(0)}%
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  );
                                })()
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="mt-12 border-t gm-univ-border pt-6 text-center">
          {/* <p className='text-xs gm-univ-muted mb-3'>
                        Not affiliated with QUT. All data is scraped from QUT
                        unit outlines. Please verify information on the
                        official QUT website. This tool is for convenience only
                        and may contain errors. QUT Grades is not responsible for
                        your grades, missed hurdles and deadlines, or that
                        Netflix binge two days before the final.
                    </p> */}
          <p className="text-xs gm-univ-muted">
            <a
              href="mailto:hello@grademate.dev?subject=QUT%20Grades%20(grademate.com)"
              className="gm-univ-muted gm-univ-hover-muted-strong underline underline-offset-2"
            >
              Report bugs, compliments, or feature ideas
            </a>
            . Made with love by{" "}
            <a
              href="https://vincelapore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="gm-univ-muted gm-univ-hover-muted-strong underline underline-offset-2"
            >
              me
            </a>
          </p>
          <p className="text-xs gm-univ-muted mt-2"></p>
        </footer>
      </main>

      {/* Mark help popup */}
      {markHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center gm-univ-modal-overlay backdrop-blur-sm p-4"
          onClick={() => setMarkHelpOpen(false)}
        >
          <div
            className="relative gm-univ-modal w-full max-w-xl rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMarkHelpOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 gm-univ-muted transition-all gm-univ-hover-surface gm-univ-hover-fg"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight gm-univ-fg">
                  How to enter marks
                </h2>
              </div>

              <div className="space-y-3 text-sm gm-univ-body">
                <div>
                  <p className="font-semibold gm-univ-fg">
                    1. Enter a percentage
                  </p>
                  <p className="mt-1 gm-univ-muted-strong">
                    Type a number like <span className="font-mono">50</span> for{" "}
                    <span className="font-mono">50%</span>.
                  </p>
                </div>

                <div>
                  <p className="font-semibold gm-univ-fg">
                    2. Enter marks out of a total
                  </p>
                  <p className="mt-1 gm-univ-muted-strong">
                    Use a fraction like <span className="font-mono">8/10</span>{" "}
                    or <span className="font-mono">24/30</span>.
                  </p>
                </div>

                <div>
                  <p className="font-semibold gm-univ-fg">
                    3. See required marks for your goal grade
                  </p>
                  <p className="mt-1 gm-univ-muted-strong">
                    Type <span className="font-mono">/50</span> in a mark field
                    to see how many marks out of 50 you need for your goal
                    grade.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar popup */}
      {calendarPopup != null &&
        calendarPopupEvents &&
        (() => {
          const course = state.courses[calendarPopup];
          if (!course) return null;
          const allEvents = calendarPopupEvents;
          const selectedEvents = allEvents.filter(
            (_, i) => calendarEventSelection[i],
          );

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center gm-univ-modal-overlay backdrop-blur-sm p-4"
              onClick={() => setCalendarPopup(null)}
            >
              <div
                className="relative gm-univ-modal w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setCalendarPopup(null)}
                  className="absolute right-6 top-6 rounded-lg p-1.5 gm-univ-muted transition-all gm-univ-hover-surface gm-univ-hover-fg"
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight gm-univ-fg">
                      Calendar Events
                    </h2>
                    <p className="mt-1.5 text-sm font-medium gm-univ-muted">
                      {course.course.courseCode} - {allEvents.length} event
                      {allEvents.length !== 1 ? "s" : ""}
                      {selectedEvents.length !== allEvents.length && (
                        <span className="gm-univ-muted">
                          {" "}
                          ({selectedEvents.length} selected)
                        </span>
                      )}
                    </p>
                  </div>

                  {allEvents.length === 0 ? (
                    <div className="rounded-xl border gm-univ-border gm-univ-surface p-6 text-center">
                      <p className="text-sm gm-univ-muted">
                        No due dates found for this course.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end">
                        {calendarEventSelection.every((v) => v) ? (
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarEventSelection(
                                allEvents.map(() => false),
                              )
                            }
                            className="text-sm gm-univ-muted gm-univ-hover-fg"
                          >
                            Deselect all
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarEventSelection(
                                allEvents.map(() => true),
                              )
                            }
                            className="text-sm gm-univ-muted gm-univ-hover-fg"
                          >
                            Select all
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {allEvents.map((event, index) => (
                          <label
                            key={index}
                            className="flex cursor-pointer items-center gap-4 rounded-xl border gm-univ-border gm-univ-surface p-4 transition-all gm-univ-hover-surface has-[:checked]:border-[var(--gm-accent)] has-[:checked]:bg-[var(--gm-accent-soft)] has-[:checked]:shadow-[0_0_0_1px_rgba(29,158,117,0.2)]"
                          >
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-semibold gm-univ-fg">
                                {event.title}
                              </h3>
                              <div className="mt-2 space-y-1 text-sm gm-univ-muted">
                                <div className="flex items-center gap-2">
                                  <svg
                                    className="h-4 w-4 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <span>
                                    {formatEventDate(event.startDate)}
                                    {event.endDate.getTime() !==
                                      event.startDate.getTime() && (
                                      <span className="ml-1">
                                        - {formatEventDate(event.endDate)}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {event.description && (
                                  <p className="text-xs gm-univ-muted mt-1">
                                    {event.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={calendarEventSelection[index] ?? true}
                              onChange={(e) =>
                                setCalendarEventSelection((prev) => {
                                  const next = [...prev];
                                  next[index] = e.target.checked;
                                  return next;
                                })
                              }
                              className="h-4 w-4 shrink-0 rounded gm-univ-border-strong gm-univ-surface text-[var(--gm-accent)] focus:ring-2 focus:ring-2 focus:ring-[rgba(29,158,117,0.3)]"
                            />
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  {allEvents.length > 0 && (
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t gm-univ-border">
                      {selectedEvents.length === 0 && (
                        <p className="text-sm text-amber-400">
                          Select at least one event to export.
                        </p>
                      )}
                      <button
                        disabled={selectedEvents.length === 0}
                        onClick={() => {
                          const icalContent = generateICal(
                            selectedEvents,
                            course.course.courseCode,
                          );

                          const blob = new Blob([icalContent], {
                            type: "text/calendar;charset=utf-8",
                          });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `${course.course.courseCode}-calendar.ics`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          trackAnalytics("calendar_export");
                        }}
                        className="gm-univ-btn-primary inline-flex items-center gap-2 px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Export to Calendar
                        {selectedEvents.length > 0 &&
                          selectedEvents.length !== allEvents.length && (
                            <span className="gm-univ-accent-text opacity-80">
                              ({selectedEvents.length})
                            </span>
                          )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Per-assessment calculator */}
      {assessmentCalculatorPopup != null &&
        (() => {
          const c = state.courses[assessmentCalculatorPopup.courseIdx];
          const itemIdx = assessmentCalculatorPopup.itemIdx;
          if (!c) return null;
          const it = c.course.items[itemIdx];
          if (!it) return null;
          const wi = c.course.items.map((x, j) => ({
            weight: x.weight,
            mark: c.marks[j] ?? null,
          }));
          const goalTarget = GRADE_THRESHOLDS[c.goalGrade];
          const courseFillerMarks = calculateEqualDistributionMarks(
            wi,
            goalTarget,
          );
          const tablePlaceholderPercent =
            it.weight === "pass/fail"
              ? null
              : (courseFillerMarks[itemIdx] ?? null);
          const assessmentCourseWeight =
            typeof it.weight === "number" ? it.weight : 0;
          const rows: SubAssessmentRow[] = ensureSubAssessmentRows(
            c.subAssessments?.[itemIdx]?.rows?.length
              ? c.subAssessments[itemIdx]!.rows.map((r) => ({
                  name: r.name,
                  mark: r.mark,
                  weight: (r as { weight?: number }).weight,
                }))
              : [{ name: "Part 1", mark: null }],
            assessmentCourseWeight,
          );
          return (
            <AssessmentCalculatorModal
              open
              onClose={() => setAssessmentCalculatorPopup(null)}
              courseCode={c.course.courseCode}
              assessmentName={it.name}
              goalMarkPercent={tablePlaceholderPercent}
              assessmentCourseWeightPercent={assessmentCourseWeight}
              courseMark={c.marks[itemIdx] ?? null}
              onCourseMarkChange={(v) =>
                updateMark(assessmentCalculatorPopup.courseIdx, itemIdx, v)
              }
              rows={rows}
              onRowsChange={(next) =>
                applySubAssessmentRows(
                  assessmentCalculatorPopup.courseIdx,
                  itemIdx,
                  next,
                )
              }
            />
          );
        })()}

      {/* Hurdle info popup */}
      {hurdlePopup != null &&
        (() => {
          const course = state.courses[hurdlePopup.courseIdx];
          if (!course) return null;
          const item = course.course.items[hurdlePopup.itemIdx];
          if (!item) return null;
          const hurdleText =
            item.hurdleRequirements || course.course.hurdleInformation || null;
          const threshold =
            item.hurdleThreshold != null
              ? `Pass threshold: ${item.hurdleThreshold}%`
              : null;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center gm-univ-modal-overlay backdrop-blur-sm p-4"
              onClick={() => setHurdlePopup(null)}
            >
              <div
                className="relative gm-univ-modal w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setHurdlePopup(null)}
                  className="absolute right-4 top-4 rounded-lg p-1.5 gm-univ-muted transition-all gm-univ-hover-surface gm-univ-hover-fg"
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                <div className="space-y-4 pr-8">
                  <div>
                    <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                      Hurdle
                    </span>
                    <h2 className="mt-2 text-lg font-bold tracking-tight gm-univ-fg">
                      {item.name}
                    </h2>
                    <p className="text-sm gm-univ-muted">
                      {course.course.courseCode}
                    </p>
                  </div>
                  {threshold && (
                    <p className="text-sm font-medium text-amber-300/90">
                      {threshold}
                    </p>
                  )}
                  {hurdleText && (
                    <div className="rounded-xl border gm-univ-border gm-univ-surface p-4">
                      <p className="whitespace-pre-wrap text-sm gm-univ-muted-strong">
                        {hurdleText}
                      </p>
                    </div>
                  )}
                  {!hurdleText && !threshold && (
                    <p className="text-sm gm-univ-muted">
                      No hurdle details available for this item.
                    </p>
                  )}
                  {course.course.courseProfileUrl && (
                    <a
                      href={`${course.course.courseProfileUrl}#assessment`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gm-univ-btn-ghost inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      View course profile
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export default function Home() {
  return (
    <GmShell variant="marketing" showFooter={true}>
      <Suspense
        fallback={
          <div className="gm-univ-page flex min-h-[50vh] items-center justify-center gm-univ-muted">
            Loading…
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </GmShell>
  );
}
