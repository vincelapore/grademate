"use client";

import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { useSearchParams } from "next/navigation";
import {
    calculateRequiredMarkForTarget,
    calculateWeightedTotal,
    GRADE_THRESHOLDS,
    percentToGradeBand,
    parseMarkToPercentage,
    formatMarkDisplay,
    calculateEqualDistributionMarks,
    type GradeBand
} from "@/lib/grades";
import {
    decodeState,
    encodeState,
    type AppState,
    type CourseState,
    type SemesterCardState
} from "@/lib/state";
import type { CourseAssessment } from "@/lib/uq-scraper";
import {
    getCurrentSemester,
    getSelectableYears,
    formatSemester,
    formatSemesterDates,
    getSemesterDates,
    type SemesterSelection,
    type SemesterType,
    type DeliveryMode
} from "@/lib/semester";
import type { DeliveryModeOption } from "@/lib/delivery-modes";
import {
    parseDueDate,
    formatEventDate,
    generateICal,
    type CalendarEvent
} from "@/lib/calendar";

const DEFAULT_GOAL: GradeBand = 7;

/** Fire-and-forget analytics event. Matches ANALYTICS_EVENTS in cache-redis (client events only used here). */
function trackAnalytics(event: string): void {
    const secret =
        typeof process.env.NEXT_PUBLIC_ANALYTICS_SECRET === "string"
            ? process.env.NEXT_PUBLIC_ANALYTICS_SECRET
            : "";
    const url = `/api/analytics${
        secret ? `?secret=${encodeURIComponent(secret)}` : ""
    }`;
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event })
    }).catch(() => {});
}

function getSemesterStart(sel: SemesterSelection): Date | null {
    const dates = getSemesterDates(sel);
    if (!dates) return null;
    return new Date(dates.start + "T00:00:00");
}

function compareSemesterSelections(
    a: SemesterSelection,
    b: SemesterSelection
): number {
    const da = getSemesterStart(a);
    const db = getSemesterStart(b);
    if (da && db) return da.getTime() - db.getTime();

    // Fallback: sort by year then by semester type.
    if (a.year !== b.year) return a.year - b.year;
    const order: SemesterType[] = ["Semester 1", "Semester 2", "Summer"];
    const ia = order.indexOf(a.semester);
    const ib = order.indexOf(b.semester);
    return ia - ib;
}

function sortSemesterCards(cards: SemesterCardState[]): SemesterCardState[] {
    if (cards.length <= 1) return cards;
    return [...cards].sort((a, b) =>
        compareSemesterSelections(a.selection, b.selection)
    );
}

function getActiveSemesterSelectionFromState(
    state: AppState
): SemesterSelection | null {
    if (
        state.activeSemesterId &&
        state.semesters &&
        state.semesters.length > 0
    ) {
        const found =
            state.semesters.find(
                (card: SemesterCardState) => card.id === state.activeSemesterId
            ) ?? state.semesters[0];
        return found.selection;
    }
    if (state.defaultSemester) {
        return state.defaultSemester;
    }
    return null;
}

function migrateSemestersFromLegacy(state: AppState): AppState {
    // If we already have semester cards, keep them sorted and ensure there's an active ID.
    if (state.semesters && state.semesters.length > 0) {
        const sorted = sortSemesterCards(state.semesters);
        if (state.activeSemesterId) {
            return {
                ...state,
                semesters: sorted
            };
        }
        const first = sorted[0];
        return {
            ...state,
            semesters: sorted,
            activeSemesterId: first?.id
        };
    }

    // If we have a legacy defaultSemester but no cards, create a single card from it.
    if (state.defaultSemester) {
        const cardId = "sem-1";
        const card: SemesterCardState = {
            id: cardId,
            selection: state.defaultSemester
        };
        return {
            ...state,
            semesters: [card],
            activeSemesterId: cardId
        };
    }

    return state;
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
    const [showSemesterChangedBanner, setShowSemesterChangedBanner] =
        useState(false);
    const [addSemesterOpen, setAddSemesterOpen] = useState(false);
    const [addCourseOpen, setAddCourseOpen] = useState(false);
    const [newSemesterSelection, setNewSemesterSelection] = useState<{
        year: number;
        semester: SemesterType;
    }>(() => {
        const current = getCurrentSemester();
        return { year: current.year, semester: current.semester };
    });

    const stateRef = useRef(state);
    stateRef.current = state;

    // Once a semester is selected, semester/year is fixed to that selection
    const effectiveSemester = useMemo(() => {
        const active = getActiveSemesterSelectionFromState(state);
        if (active) {
            return {
                year: active.year,
                semester: active.semester
            };
        }
        return semester;
    }, [state, semester]);

    const activeSemesterSelection = useMemo(
        () => getActiveSemesterSelectionFromState(state),
        [state]
    );

    const coursesForActiveSemester = useMemo(() => {
        if (!activeSemesterSelection) return state.courses;
        return state.courses.filter((c) => {
            if (!c.semester) return true;
            return (
                c.semester.year === activeSemesterSelection.year &&
                c.semester.semester === activeSemesterSelection.semester &&
                c.semester.delivery === activeSemesterSelection.delivery
            );
        });
    }, [state.courses, activeSemesterSelection]);

    const coursesBySemesterId = useMemo(() => {
        const map: Record<string, CourseState[]> = {};
        if (!state.semesters) return map;
        for (const card of state.semesters) {
            map[card.id] = state.courses.filter((c) => {
                if (!c.semester) return true;
                return (
                    c.semester.year === card.selection.year &&
                    c.semester.semester === card.selection.semester &&
                    c.semester.delivery === card.selection.delivery
                );
            });
        }
        return map;
    }, [state.semesters, state.courses]);

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
                        title: `${course.course.courseCode}: ${item.name}${event.title && event.title !== item.name ? ` - ${event.title}` : ""}`
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

    const STORAGE_KEY = "uqgrades-state";

    // Hydrate on first load: shared link (URL) overrides, otherwise use localStorage
    useEffect(() => {
        if (isHydrated) return;
        const encodedFromUrl = searchParams.get("data");
        const fromUrl = decodeState(encodedFromUrl);
        if (fromUrl?.courses?.length) {
            const migrated = migrateSemestersFromLegacy(fromUrl);
            setState(migrated);
            const active = getActiveSemesterSelectionFromState(migrated);
            if (active) {
                setSemester({
                    year: active.year,
                    semester: active.semester
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
                    const migrated = migrateSemestersFromLegacy(decoded);
                    setState(migrated);
                    const active =
                        getActiveSemesterSelectionFromState(migrated);
                    if (active) {
                        setSemester({
                            year: active.year,
                            semester: active.semester
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
                    if (encoded)
                        window.localStorage.setItem(STORAGE_KEY, encoded);
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
            const active = getActiveSemesterSelectionFromState(state);
            const effective =
                state.courses.length > 0 && active
                    ? {
                          year: active.year,
                          semester: active.semester
                      }
                    : semester;
            if (
                current.year !== effective.year ||
                current.semester !== effective.semester
            ) {
                if (state.courses.length === 0) {
                    setSemester({
                        year: current.year,
                        semester: current.semester
                    });
                } else {
                    setShowSemesterChangedBanner(true);
                }
            }
        };
        if (typeof window === "undefined") return;
        window.addEventListener("visibilitychange", handler);
        return () => window.removeEventListener("visibilitychange", handler);
    }, [state, semester]);

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
                    semester: effectiveSemester.semester
                });
                const res = await fetch(
                    `/api/delivery-modes?${params.toString()}`
                );
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(
                        body.error ||
                            `Failed to find delivery modes for ${code}`
                    );
                }
                const data = await res.json();
                setPendingCourse({
                    courseCode: code,
                    year: effectiveSemester.year,
                    semester: effectiveSemester.semester,
                    deliveryModes: data.modes
                });
                setCourseInput("");
            } catch (e) {
                setError(
                    e instanceof Error
                        ? e.message
                        : "Failed to find delivery modes."
                );
            } finally {
                setLoadingDeliveryModes(false);
            }
        },
        [effectiveSemester]
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
                    delivery: deliveryMode.delivery
                });
                const res = await fetch(`/api/scrape?${params.toString()}`);
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(
                        body.error ||
                            `Failed to load course ${pendingCourse.courseCode}`
                    );
                }
                const course = (await res.json()) as CourseAssessment;
                const marks = course.items.map(() => null);
                const fullSemester: SemesterSelection = {
                    year: pendingCourse.year,
                    semester: pendingCourse.semester,
                    delivery: deliveryMode.delivery
                };
                const courseState: CourseState = {
                    course,
                    marks,
                    goalGrade: DEFAULT_GOAL,
                    semester: fullSemester
                };
                setState((prev) => {
                    const nextCourses = [...prev.courses, courseState];

                    // Ensure we have semester cards and keep them in sync with the latest added course.
                    let nextSemesters = prev.semesters ?? [];
                    let nextActiveId = prev.activeSemesterId;

                    if (nextSemesters.length === 0) {
                        const cardId = "sem-1";
                        nextSemesters = [
                            {
                                id: cardId,
                                selection: fullSemester
                            }
                        ];
                        nextActiveId = cardId;
                    } else {
                        const activeId =
                            nextActiveId ?? nextSemesters[0]?.id ?? "sem-1";
                        nextSemesters = nextSemesters.map((card) =>
                            card.id === activeId
                                ? { ...card, selection: fullSemester }
                                : card
                        );
                        nextActiveId = activeId;
                    }

                    nextSemesters = sortSemesterCards(nextSemesters);

                    return {
                        ...prev,
                        courses: nextCourses,
                        defaultSemester: fullSemester,
                        semesters: nextSemesters,
                        activeSemesterId: nextActiveId
                    };
                });
                setPendingCourse(null);
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : "Failed to load course."
                );
            } finally {
                setLoadingCourse(false);
                setLoadingCourseForDelivery(null);
            }
        },
        [pendingCourse]
    );

    const updateMark = useCallback(
        (courseIndex: number, itemIndex: number, value: string) => {
            // Allow empty string, fractions like "9/10", percentages like "90", or "/XX" patterns
            const trimmed = value.trim();
            const markValue = trimmed === "" ? null : trimmed;

            // Validate: if it's not empty and not a valid format, don't update
            if (markValue != null) {
                // Allow "/" and "/XX" patterns (user typing "/50")
                if (markValue.match(/^\/\d*$/)) {
                    // Allow it - user is typing "/XX"
                } else if (
                    // Allow full fraction "85/100" or partial "85/" / "85/1" so user can type "85/100"
                    markValue.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d*(?:\.\d+)?)$/)
                ) {
                    // Allow it - full or partial fraction
                } else {
                    // Check if it's a valid number (percentage)
                    const num = parseFloat(markValue);
                    if (Number.isNaN(num) || num < 0 || num > 100) {
                        return; // Invalid, don't update
                    }
                }
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
        []
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
            courses: prev.courses.filter((_, i) => i !== index)
        }));
        trackAnalytics("remove_course");
    }, []);

    const copyLink = useCallback(async () => {
        try {
            const encoded = encodeState(stateRef.current);
            const url = encoded
                ? `${window.location.origin}/university/uq?data=${encoded}`
                : window.location.origin + "/university/uq";
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
        setState({
            courses: [],
            semesters: [],
            activeSemesterId: undefined,
            defaultSemester: undefined
        });
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
        if (!coursesForActiveSemester.length) return null;

        // Calculate overall (includes unmarked as 0)
        const totals = coursesForActiveSemester.map((c) =>
            calculateWeightedTotal(
                c.course.items.map((it, idx) => ({
                    weight: it.weight,
                    mark: c.marks[idx] ?? null
                }))
            )
        );
        const overallAvg = totals.reduce((a, b) => a + b, 0) / totals.length;
        const overallBand = percentToGradeBand(overallAvg);

        // Calculate current grade (only assessments with marks)
        const currentGrades = coursesForActiveSemester
            .map((c) => {
                let markedSum = 0;
                let markedWeightSum = 0;

                c.course.items.forEach((it, idx) => {
                    if (it.weight === "pass/fail") return;
                    const mark = c.marks[idx];
                    const percentage = parseMarkToPercentage(mark);

                    if (percentage != null && !Number.isNaN(percentage)) {
                        const weight =
                            typeof it.weight === "number" ? it.weight : 0;
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
                ? currentGrades.reduce((a, b) => a + b, 0) /
                  currentGrades.length
                : null;

        return {
            overall: { avg: overallAvg, band: overallBand },
            current:
                currentAvg != null
                    ? { avg: currentAvg, band: percentToGradeBand(currentAvg) }
                    : null
        };
    }, [coursesForActiveSemester]);

    return (
        <div className='min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-50'>
            <main className='mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 pb-20 pt-12 sm:px-6 lg:px-8'>
                {showSemesterChangedBanner && (
                    <div className='rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex flex-wrap items-center justify-between gap-2'>
                        <span>
                            Semester has changed. Reset to use the new default?
                        </span>
                        <div className='flex gap-2'>
                            <button
                                type='button'
                                onClick={() => {
                                    setShowSemesterChangedBanner(false);
                                }}
                                className='rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700'
                            >
                                Dismiss
                            </button>
                            <button
                                type='button'
                                onClick={() => {
                                    setShowSemesterChangedBanner(false);
                                    handleReset();
                                }}
                                className='rounded border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/30'
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                )}
                <header className='flex flex-col gap-5 border-b border-slate-800/50 pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
                    <div className='relative min-w-0'>
                        <h1 className='text-2xl font-bold tracking-tight text-slate-50 sm:text-4xl'>
                            UQ Grades
                        </h1>
                        <p className='mt-1 text-sm text-slate-400 max-w-md'>
                            Track your sem progress, calculate grades, and see
                            what you need to hit that 7 (or 4).{" "}
                            <button
                                type='button'
                                onClick={() => {
                                    setHowToOpen(true);
                                    trackAnalytics("how_to_opened");
                                }}
                                className='text-slate-400 underline underline-offset-2 transition-colors hover:text-slate-200'
                            >
                                How to use
                            </button>
                        </p>
                        {howToOpen && (
                            <div
                                className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
                                onClick={() => setHowToOpen(false)}
                                role='dialog'
                                aria-labelledby='how-to-title'
                                aria-modal='true'
                            >
                                <div
                                    className='relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 p-6 shadow-2xl backdrop-blur-xl'
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type='button'
                                        onClick={() => setHowToOpen(false)}
                                        aria-label='Close'
                                        className='absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-200'
                                    >
                                        <svg
                                            className='h-5 w-5'
                                            fill='none'
                                            stroke='currentColor'
                                            viewBox='0 0 24 24'
                                        >
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth={2}
                                                d='M6 18L18 6M6 6l12 12'
                                            />
                                        </svg>
                                    </button>

                                    <div className='space-y-4'>
                                        <div>
                                            <h2
                                                id='how-to-title'
                                                className='text-xl font-bold tracking-tight text-slate-50'
                                            >
                                                How to use
                                            </h2>
                                        </div>

                                        <div className='space-y-3 text-sm text-slate-200'>
                                            <div>
                                                <p className='font-semibold text-slate-100'>
                                                    1. Add a course
                                                </p>
                                                <p className='mt-1 text-slate-300'>
                                                    Choose semester and year,
                                                    enter the course code (e.g.{" "}
                                                    <span className='font-mono'>
                                                        CSSE3100
                                                    </span>
                                                    ), click Find, then pick the
                                                    delivery (e.g. Internal,
                                                    External).
                                                </p>
                                            </div>
                                            <div>
                                                <p className='font-semibold text-slate-100'>
                                                    2. Enter marks
                                                </p>
                                                <p className='mt-1 text-slate-300'>
                                                    Type your result for each
                                                    assessment (e.g.{" "}
                                                    <span className='font-mono'>
                                                        8/10
                                                    </span>
                                                    ,{" "}
                                                    <span className='font-mono'>
                                                        85
                                                    </span>
                                                    , or{" "}
                                                    <span className='font-mono'>
                                                        17/20
                                                    </span>
                                                    ). Your current and overall
                                                    grade update as you go.
                                                </p>
                                            </div>
                                            <div>
                                                <p className='font-semibold text-slate-100'>
                                                    3. See what you need
                                                </p>
                                                <p className='mt-1 text-slate-300'>
                                                    Use the &quot;Need X%&quot;
                                                    column to see the mark
                                                    required on remaining items
                                                    to reach your target grade
                                                    (default is 7).
                                                </p>
                                            </div>
                                            <div>
                                                <p className='font-semibold text-slate-100'>
                                                    4. Save or share
                                                </p>
                                                <p className='mt-1 text-slate-300'>
                                                    Your progress is saved
                                                    automatically in this
                                                    browser. Use Copy link to
                                                    share your grades with
                                                    someone else.
                                                </p>
                                            </div>
                                            <div>
                                                <p className='font-semibold text-slate-100'>
                                                    5. Calendar
                                                </p>
                                                <p className='mt-1 text-slate-300'>
                                                    Open Calendar on a course to
                                                    choose which due-date events
                                                    to include, then Export to
                                                    Calendar to download an .ics
                                                    file.
                                                </p>
                                            </div>
                                            <div>
                                                <p className='font-semibold text-slate-100'>
                                                    6. Start over
                                                </p>
                                                <p className='mt-1 text-slate-300'>
                                                    Use Reset to clear all
                                                    courses and marks.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className='flex flex-wrap items-center gap-2 sm:flex-shrink-0'>
                        {state.courses.length > 0 && (
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                className='min-h-[44px] rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300 active:bg-slate-800/50 sm:min-h-0 sm:py-2'
                            >
                                Reset
                            </button>
                        )}
                        <button
                            onClick={copyLink}
                            className='group min-h-[44px] rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300 active:bg-slate-800/50 sm:min-h-0 sm:py-2'
                        >
                            {linkCopied ? "Copied!" : "Copy link"}
                        </button>
                        <a
                            href='https://buymeacoffee.com/vincelapore'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex min-h-[44px] items-center rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300 active:bg-slate-800/50 sm:min-h-0 sm:py-2'
                        >
                            Buy Me a Coffee ☕
                        </a>
                    </div>
                </header>

                {showResetConfirm && (
                    <div
                        className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
                        onClick={() => setShowResetConfirm(false)}
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='reset-dialog-title'
                    >
                        <div
                            className='mx-4 w-full max-w-sm rounded-xl border border-slate-700/50 bg-slate-900 p-6 shadow-xl'
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2
                                id='reset-dialog-title'
                                className='text-lg font-semibold text-slate-50'
                            >
                                Reset everything?
                            </h2>
                            <p className='mt-2 text-sm text-slate-400'>
                                This will remove all courses and marks. You
                                can&apos;t undo this.
                            </p>
                            <div className='mt-6 flex gap-3'>
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className='flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700'
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReset}
                                    className='flex-1 rounded-lg border border-rose-500/50 bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/30'
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {addSemesterOpen && (
                    <div
                        className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
                        onClick={() => setAddSemesterOpen(false)}
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='add-semester-title'
                    >
                        <div
                            className='mx-4 w-full max-w-sm rounded-xl border border-slate-700/50 bg-slate-900 p-6 shadow-xl'
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2
                                id='add-semester-title'
                                className='text-lg font-semibold text-slate-50'
                            >
                                Add semester
                            </h2>
                            <p className='mt-2 text-sm text-slate-400'>
                                Choose the year and semester to create a new
                                card on the dashboard.
                            </p>
                            <div className='mt-4 grid grid-cols-2 gap-3'>
                                <div>
                                    <label className='mb-1 block text-xs font-medium text-slate-400'>
                                        Year
                                    </label>
                                    <select
                                        value={newSemesterSelection.year}
                                        onChange={(e) =>
                                            setNewSemesterSelection((prev) => ({
                                                ...prev,
                                                year: parseInt(
                                                    e.target.value,
                                                    10
                                                )
                                            }))
                                        }
                                        className='w-full rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs font-medium outline-none backdrop-blur-sm transition-all focus:border-sky-500/50 focus:bg-slate-900/50 focus:ring-2 focus:ring-sky-500/20'
                                    >
                                        {getSelectableYears().map((y) => (
                                            <option key={y} value={y}>
                                                {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className='mb-1 block text-xs font-medium text-slate-400'>
                                        Semester
                                    </label>
                                    <select
                                        value={newSemesterSelection.semester}
                                        onChange={(e) =>
                                            setNewSemesterSelection((prev) => ({
                                                ...prev,
                                                semester: e.target
                                                    .value as SemesterType
                                            }))
                                        }
                                        className='w-full rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs font-medium outline-none backdrop-blur-sm transition-all focus:border-sky-500/50 focus:bg-slate-900/50 focus:ring-2 focus:ring-sky-500/20'
                                    >
                                        <option value='Semester 1'>
                                            Sem 1
                                        </option>
                                        <option value='Semester 2'>
                                            Sem 2
                                        </option>
                                        <option value='Summer'>Summer</option>
                                    </select>
                                </div>
                            </div>
                            <div className='mt-6 flex gap-3'>
                                <button
                                    type='button'
                                    onClick={() => setAddSemesterOpen(false)}
                                    className='flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    onClick={() => {
                                        const selection: SemesterSelection = {
                                            year: newSemesterSelection.year,
                                            semester:
                                                newSemesterSelection.semester,
                                            delivery: "Internal"
                                        };
                                        setState((prev) => {
                                            const id = `sem-${Date.now()}`;
                                            const semesters: SemesterCardState[] =
                                                sortSemesterCards([
                                                    ...(prev.semesters ?? []),
                                                    { id, selection }
                                                ]);
                                            return {
                                                ...prev,
                                                semesters,
                                                activeSemesterId: id,
                                                defaultSemester: selection
                                            };
                                        });
                                        trackAnalytics("semester_card_added");
                                        setAddSemesterOpen(false);
                                    }}
                                    className='flex-1 rounded-lg border border-sky-500/60 bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-500/30'
                                >
                                    Add semester
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Course Modal */}
                {addCourseOpen && (
                    <div
                        className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md'
                        onClick={() => {
                            setAddCourseOpen(false);
                            setPendingCourse(null);
                            setError(null);
                        }}
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='add-course-title'
                    >
                        <div
                            className='mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-8 shadow-2xl'
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2
                                id='add-course-title'
                                className='text-xl font-bold text-slate-50'
                            >
                                Add course
                            </h2>
                            <p className='mt-2 text-sm text-slate-400'>
                                {effectiveSemester.semester} {effectiveSemester.year}
                            </p>

                            <div className='mt-6 space-y-4'>
                                {!pendingCourse ? (
                                    <>
                                        <div>
                                            <label className='mb-2 block text-sm font-medium text-slate-300'>
                                                Course code
                                            </label>
                                            <input
                                                value={courseInput}
                                                onChange={(e) =>
                                                    setCourseInput(
                                                        e.target.value.toUpperCase()
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        void findDeliveryModes(
                                                            courseInput
                                                        );
                                                    }
                                                }}
                                                placeholder='e.g. CSSE3100'
                                                className='w-full rounded-lg border border-slate-700/50 bg-slate-950/50 px-4 py-3 text-base font-medium outline-none backdrop-blur-sm placeholder:text-slate-500 transition-all focus:border-sky-500/50 focus:bg-slate-900/50 focus:ring-2 focus:ring-sky-500/20'
                                                autoFocus
                                            />
                                        </div>
                                        {error && (
                                            <p className='text-sm font-medium text-rose-400'>
                                                {error}
                                            </p>
                                        )}
                                        <div className='flex gap-3 pt-2'>
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setAddCourseOpen(false);
                                                    setError(null);
                                                }}
                                                className='flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700'
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                disabled={loadingDeliveryModes || !courseInput.trim()}
                                                onClick={() =>
                                                    void findDeliveryModes(courseInput)
                                                }
                                                className='flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:from-sky-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none'
                                            >
                                                {loadingDeliveryModes ? (
                                                    <>
                                                        <span
                                                            className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white'
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
                                    <div className='space-y-4'>
                                        <div className='rounded-lg border border-slate-800/50 bg-slate-950/50 p-4'>
                                            <p className='text-sm font-medium text-slate-300'>
                                                {pendingCourse.courseCode}
                                            </p>
                                            <p className='text-xs text-slate-500 mt-1'>
                                                {pendingCourse.semester} {pendingCourse.year}
                                            </p>
                                        </div>
                                        <div>
                                            <p className='text-sm font-medium text-slate-300 mb-3'>
                                                Select delivery mode:
                                            </p>
                                            <div className='space-y-2'>
                                                {pendingCourse.deliveryModes.map(
                                                    (mode, idx) => {
                                                        const isLoading =
                                                            loadingCourse &&
                                                            loadingCourseForDelivery ===
                                                                mode.delivery;
                                                        return (
                                                            <button
                                                                key={idx}
                                                                disabled={loadingCourse}
                                                                onClick={() => {
                                                                    void addCourse(mode);
                                                                    setAddCourseOpen(false);
                                                                }}
                                                                className='w-full rounded-lg border border-slate-700/50 bg-slate-950/50 px-4 py-3 text-left text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50'
                                                            >
                                                                <div className='flex items-center justify-between gap-2'>
                                                                    <span className='flex items-center gap-2'>
                                                                        {isLoading && (
                                                                            <span
                                                                                className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-sky-400'
                                                                                aria-hidden
                                                                            />
                                                                        )}
                                                                        <span>{mode.delivery}</span>
                                                                    </span>
                                                                    {mode.location && (
                                                                        <span className='text-xs text-slate-500'>
                                                                            {mode.location}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setPendingCourse(null)}
                                            className='w-full rounded-lg border border-slate-700/50 bg-slate-950/50 px-4 py-2 text-sm font-medium text-slate-400 backdrop-blur-sm transition-all hover:border-slate-600 hover:bg-slate-900/50'
                                        >
                                            Back
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Dashboard: semester cards grid */}
                <section className='grid gap-4 sm:grid-cols-3'>
                    {(state.semesters ?? []).map((card) => {
                        const isActive = card.id === state.activeSemesterId;
                        const coursesForCard =
                            coursesBySemesterId[card.id] ?? [];
                        return (
                            <div
                                key={card.id}
                                className={`flex flex-col items-start justify-between rounded-2xl border px-4 py-4 text-left shadow-md transition-all sm:px-5 sm:py-5 ${
                                    isActive
                                        ? "border-sky-500/70 bg-sky-500/15 text-sky-100 shadow-sky-500/30"
                                        : "border-slate-700/70 bg-slate-900/70 text-slate-100 hover:border-slate-500 hover:bg-slate-900"
                                }`}
                                onClick={() =>
                                    setState((prev) => ({
                                        ...prev,
                                        activeSemesterId: card.id,
                                        defaultSemester: card.selection
                                    }))
                                }
                            >
                                <div className='flex w-full items-start justify-between gap-2'>
                                    <div className='space-y-1'>
                                        <p className='text-sm font-bold'>
                                            {formatSemester(card.selection)}
                                        </p>
                                        <p className='text-[11px] text-slate-400'>
                                            {formatSemesterDates(
                                                card.selection
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type='button'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setState((prev) => {
                                                const semesters =
                                                    prev.semesters ?? [];
                                                const remaining =
                                                    semesters.filter(
                                                        (c) => c.id !== card.id
                                                    );
                                                const courses =
                                                    prev.courses.filter((c) => {
                                                        if (!c.semester)
                                                            return true;
                                                        return !(
                                                            c.semester.year ===
                                                                card.selection
                                                                    .year &&
                                                            c.semester
                                                                .semester ===
                                                                card.selection
                                                                    .semester &&
                                                            c.semester
                                                                .delivery ===
                                                                card.selection
                                                                    .delivery
                                                        );
                                                    });
                                                let activeSemesterId =
                                                    prev.activeSemesterId;
                                                let defaultSemester =
                                                    prev.defaultSemester;

                                                if (
                                                    activeSemesterId === card.id
                                                ) {
                                                    activeSemesterId =
                                                        remaining[0]?.id;
                                                }

                                                if (activeSemesterId) {
                                                    const newActive =
                                                        remaining.find(
                                                            (c) =>
                                                                c.id ===
                                                                activeSemesterId
                                                        ) ?? remaining[0];
                                                    defaultSemester =
                                                        newActive?.selection;
                                                } else {
                                                    defaultSemester = undefined;
                                                }

                                                return {
                                                    ...prev,
                                                    semesters: remaining,
                                                    courses,
                                                    activeSemesterId,
                                                    defaultSemester
                                                };
                                            });
                                        }}
                                        className='rounded-full p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 transition-colors'
                                        aria-label='Delete semester'
                                    >
                                        <svg
                                            className='h-3.5 w-3.5'
                                            viewBox='0 0 24 24'
                                            fill='none'
                                            stroke='currentColor'
                                        >
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth={2}
                                                d='M6 7h12M10 11v6m4-6v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0h10l-1 11a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7z'
                                            />
                                        </svg>
                                    </button>
                                </div>
                                <div className='mt-4 w-full space-y-1 text-[11px]'>
                                    {coursesForCard.map((course) => {
                                        // Compute current standing based only on entered marks.
                                        let markedSum = 0;
                                        let markedWeightSum = 0;
                                        let allMarked = true;

                                        course.course.items.forEach(
                                            (item, idx) => {
                                                if (
                                                    item.weight ===
                                                        "pass/fail" ||
                                                    typeof item.weight !==
                                                        "number"
                                                ) {
                                                    return;
                                                }
                                                const mark = course.marks[idx];
                                                const percentage =
                                                    parseMarkToPercentage(mark);
                                                if (
                                                    percentage != null &&
                                                    !Number.isNaN(percentage)
                                                ) {
                                                    markedSum +=
                                                        (percentage *
                                                            item.weight) /
                                                        100;
                                                    markedWeightSum +=
                                                        item.weight;
                                                } else {
                                                    allMarked = false;
                                                }
                                            }
                                        );

                                        const currentPercent =
                                            markedWeightSum > 0
                                                ? (markedSum /
                                                      markedWeightSum) *
                                                  100
                                                : null;
                                        const currentBand =
                                            currentPercent != null
                                                ? percentToGradeBand(
                                                      currentPercent
                                                  )
                                                : null;
                                        const currentClass =
                                            currentBand == null
                                                ? "text-slate-500"
                                                : allMarked
                                                  ? "text-slate-50"
                                                  : "text-slate-400";

                                        return (
                                            <div
                                                key={course.course.courseCode}
                                                className='flex items-center justify-between gap-2'
                                            >
                                                <span className='truncate font-semibold text-slate-200'>
                                                    {course.course.courseCode}
                                                </span>
                                                <div className='flex items-center gap-2'>
                                                    <span
                                                        className={currentClass}
                                                    >
                                                        {currentBand != null ? (
                                                            <>{currentBand}</>
                                                        ) : (
                                                            "NA"
                                                        )}
                                                    </span>
                                                    <span className='text-emerald-400 font-semibold'>
                                                        Goal {course.goalGrade}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {/* Add-semester card */}
                    <button
                        type='button'
                        onClick={() => {
                            const baseSelection =
                                getActiveSemesterSelectionFromState(state) ??
                                getCurrentSemester();
                            setNewSemesterSelection({
                                year: baseSelection.year,
                                semester: baseSelection.semester
                            });
                            setAddSemesterOpen(true);
                        }}
                        className='flex min-h-[120px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700/70 bg-slate-950/40 text-slate-400 transition-all hover:border-sky-500/70 hover:bg-sky-500/5 hover:text-sky-300'
                    >
                        <span className='mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-base font-semibold'>
                            +
                        </span>
                        <span className='text-xs font-medium'>
                            Add semester
                        </span>
                    </button>
                </section>

                {activeSemesterSelection ? (
                    <>
                        <section className='flex items-center justify-between gap-4 rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 via-slate-950/50 to-slate-900/30 p-6 backdrop-blur-sm shadow-xl shadow-black/20'>
                            <div className='min-w-0 flex-1'>
                                {dashboardSummary ? (
                                    <div className='flex flex-wrap items-center gap-x-8 gap-y-2'>
                                        {dashboardSummary.current && (
                                            <div className='min-w-0'>
                                                <p className='text-xs font-medium uppercase tracking-wider text-slate-500 mb-1'>
                                                    Current
                                                </p>
                                                <p className='text-xl font-bold tracking-tight text-slate-50'>
                                                    <span className='inline-block bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent'>
                                                        {dashboardSummary.current.avg.toFixed(1)}%
                                                    </span>
                                                    <span className='text-slate-400 ml-2 text-base font-semibold'>
                                                        Grade {dashboardSummary.current.band}
                                                    </span>
                                                </p>
                                            </div>
                                        )}
                                        <div className='min-w-0'>
                                            <p className='text-xs font-medium uppercase tracking-wider text-slate-500 mb-1'>
                                                Overall
                                            </p>
                                            <p className='text-xl font-bold tracking-tight text-slate-50'>
                                                <span className='inline-block bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent'>
                                                    {dashboardSummary.overall.avg.toFixed(1)}%
                                                </span>
                                                <span className='text-slate-400 ml-2 text-base font-semibold'>
                                                    Grade {dashboardSummary.overall.band}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className='text-sm text-slate-500'>
                                        Add a course to get started
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setCourseInput("");
                                    setPendingCourse(null);
                                    setError(null);
                                    setAddCourseOpen(true);
                                }}
                                className='shrink-0 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:from-sky-400 hover:to-cyan-400 hover:shadow-xl hover:shadow-sky-500/30'
                            >
                                <span className='text-lg leading-none'>+</span>
                                Add course
                            </button>
                        </section>

                        <section className='space-y-4'>
                            {coursesForActiveSemester.map((c, idx) => {
                                const weightedItems = c.course.items.map(
                                    (it, i) => ({
                                        weight: it.weight,
                                        mark: c.marks[i] ?? null // Will be parsed in calculateWeightedTotal
                                    })
                                );
                                const total =
                                    calculateWeightedTotal(weightedItems);
                                const band = percentToGradeBand(total);
                                const goalTarget =
                                    GRADE_THRESHOLDS[c.goalGrade];

                                // Debug: verify maxPossibleTotal matches total when all assessments have marks
                                // (This will be calculated below)

                                // Calculate equal distribution filler marks for all uncompleted assessments
                                const fillerMarks =
                                    calculateEqualDistributionMarks(
                                        weightedItems,
                                        goalTarget
                                    );

                                // Find the last non-pass/fail assessment for "needed on final" calculation
                                let lastIndex = -1;
                                for (
                                    let i = c.course.items.length - 1;
                                    i >= 0;
                                    i--
                                ) {
                                    if (
                                        c.course.items[i].weight !== "pass/fail"
                                    ) {
                                        lastIndex = i;
                                        break;
                                    }
                                }

                                const neededOnFinal =
                                    lastIndex >= 0
                                        ? calculateRequiredMarkForTarget(
                                              weightedItems,
                                              goalTarget,
                                              lastIndex
                                          )
                                        : null;

                                // Check if any marks have been entered
                                const hasEnteredMarks = c.marks.some((mark) => {
                                    const parsed = parseMarkToPercentage(mark);
                                    return (
                                        parsed != null && !Number.isNaN(parsed)
                                    );
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
                                    const markPercentage =
                                        parseMarkToPercentage(mark);

                                    if (
                                        markPercentage != null &&
                                        !Number.isNaN(markPercentage)
                                    ) {
                                        // Has a mark: add (mark percentage * weight) / 100
                                        maxPossibleTotal +=
                                            (markPercentage * item.weight) /
                                            100;
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
                                        `Calculation mismatch: total=${total}, maxPossibleTotal=${maxPossibleTotal}`
                                    );
                                }

                                // Check if goal grade is achievable
                                // Goal is unachievable if max possible total (assuming 100% on all empty) < goal threshold
                                const isGoalAchievable =
                                    !hasEnteredMarks || // If no marks entered, assume achievable
                                    maxPossibleTotal >= goalTarget;

                                // Highest achievable grade if they get 100% on all remaining
                                const highestAchievableGrade =
                                    percentToGradeBand(maxPossibleTotal);

                                // Also check if neededOnFinal is >= 100 (for display purposes)
                                const requiresPerfectScore =
                                    hasEnteredMarks &&
                                    neededOnFinal != null &&
                                    neededOnFinal >= 100;

                                return (
                                    <article
                                        key={c.course.courseCode + idx}
                                        className='group rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 via-slate-950/50 to-slate-900/30 p-6 backdrop-blur-sm shadow-xl shadow-black/20 transition-all hover:border-slate-700/50 hover:shadow-2xl hover:shadow-black/30 sm:p-8'
                                    >
                                        <div className='mb-6 flex min-w-0 flex-wrap items-start justify-between gap-3'>
                                            <div className='min-w-0 flex-1'>
                                                <div className='flex flex-wrap items-center gap-2 gap-y-2'>
                                                    <div>
                                                        <h2 className='text-xl font-bold tracking-tight text-slate-50'>
                                                            {
                                                                c.course
                                                                    .courseCode
                                                            }
                                                            {(() => {
                                                                const raw =
                                                                    c.course.title?.trim() ??
                                                                    "";
                                                                const cleaned =
                                                                    raw
                                                                        .replace(
                                                                            new RegExp(
                                                                                `\\s*\\(${c.course.courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`,
                                                                                "i"
                                                                            ),
                                                                            ""
                                                                        )
                                                                        .trim();
                                                                return cleaned
                                                                    ? ": " +
                                                                          cleaned
                                                                    : "";
                                                            })()}
                                                        </h2>
                                                    </div>
                                                    {c.course
                                                        .courseProfileUrl && (
                                                        <a
                                                            href={`${c.course.courseProfileUrl}#assessment`}
                                                            target='_blank'
                                                            rel='noopener noreferrer'
                                                            className='inline-flex items-center rounded-lg border border-slate-700/50 bg-slate-950/50 p-1.5 text-slate-400 backdrop-blur-sm transition-all hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300'
                                                            title='View course profile'
                                                        >
                                                            <svg
                                                                className='h-3.5 w-3.5'
                                                                fill='none'
                                                                stroke='currentColor'
                                                                viewBox='0 0 24 24'
                                                                xmlns='http://www.w3.org/2000/svg'
                                                            >
                                                                <path
                                                                    strokeLinecap='round'
                                                                    strokeLinejoin='round'
                                                                    strokeWidth={
                                                                        2
                                                                    }
                                                                    d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                                                                />
                                                            </svg>
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setCalendarPopup(
                                                                idx
                                                            );
                                                            trackAnalytics(
                                                                "calendar_popup_opened"
                                                            );
                                                        }}
                                                        className='inline-flex shrink-0 items-center rounded-lg border border-slate-700/50 bg-slate-950/50 px-2.5 py-1.5 text-xs font-medium text-slate-400 backdrop-blur-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300'
                                                        title='Save to calendar'
                                                    >
                                                        <svg
                                                            className='h-3.5 w-3.5 mr-1.5'
                                                            fill='none'
                                                            stroke='currentColor'
                                                            viewBox='0 0 24 24'
                                                            xmlns='http://www.w3.org/2000/svg'
                                                        >
                                                            <path
                                                                strokeLinecap='round'
                                                                strokeLinejoin='round'
                                                                strokeWidth={2}
                                                                d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                                                            />
                                                        </svg>
                                                        Calendar
                                                    </button>
                                                </div>
                                                <p className='mt-2 text-sm'>
                                                    <span className='font-bold bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent'>
                                                        {total.toFixed(1)}%
                                                    </span>
                                                    <span className='text-slate-500 ml-2 font-medium'>
                                                        Grade {band}
                                                    </span>
                                                </p>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    removeCourse(idx)
                                                }
                                                className='shrink-0 rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-1.5 text-xs font-medium text-slate-400 backdrop-blur-sm transition-all hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300'
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                                            <div className='flex-1'>
                                                <div className='h-2 overflow-hidden rounded-full bg-slate-800/50 backdrop-blur-sm'>
                                                    <div
                                                        className='h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 shadow-lg shadow-sky-500/30'
                                                        style={{
                                                            width: `${Math.min(100, total)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className='flex items-center gap-3 text-sm sm:mt-0'>
                                                <select
                                                    value={c.goalGrade}
                                                    onChange={(e) =>
                                                        updateGoal(
                                                            idx,
                                                            Number(
                                                                e.target.value
                                                            ) as GradeBand
                                                        )
                                                    }
                                                    className='rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-sm outline-none transition-all focus:border-sky-500/50 focus:bg-slate-900/50 focus:ring-2 focus:ring-sky-500/20'
                                                >
                                                    {[4, 5, 6, 7].map((g) => (
                                                        <option
                                                            key={g}
                                                            value={g}
                                                        >
                                                            Grade {g}
                                                        </option>
                                                    ))}
                                                </select>
                                                {hasEnteredMarks && (
                                                    <>
                                                        {isGoalAchievable ? (
                                                            neededOnFinal !=
                                                                null &&
                                                            !requiresPerfectScore ? (
                                                                <span className='text-slate-400'>
                                                                    Need{" "}
                                                                    <span className='font-bold text-emerald-400'>
                                                                        {neededOnFinal.toFixed(
                                                                            1
                                                                        )}
                                                                        %
                                                                    </span>{" "}
                                                                    on final
                                                                </span>
                                                            ) : (
                                                                <span className='text-slate-400'>
                                                                    Grade{" "}
                                                                    {
                                                                        c.goalGrade
                                                                    }{" "}
                                                                    achievable
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className='text-rose-400'>
                                                                <span className='font-bold'>
                                                                    Grade{" "}
                                                                    {
                                                                        c.goalGrade
                                                                    }{" "}
                                                                    not
                                                                    achievable
                                                                </span>
                                                                {highestAchievableGrade !=
                                                                    null &&
                                                                    highestAchievableGrade <
                                                                        c.goalGrade && (
                                                                        <span className='ml-2 text-xs font-medium'>
                                                                            (Max:
                                                                            Grade{" "}
                                                                            {
                                                                                highestAchievableGrade
                                                                            }
                                                                            )
                                                                        </span>
                                                                    )}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className='overflow-x-auto rounded-xl border border-slate-800/50 bg-slate-950/30 backdrop-blur-sm'>
                                            <table className='min-w-full divide-y divide-slate-800/50 text-xs'>
                                                <thead className='bg-slate-900/50'>
                                                    <tr>
                                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400'>
                                                            Assessment
                                                        </th>
                                                        <th className='px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400'>
                                                            Weight
                                                        </th>
                                                        <th className='px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400'>
                                                            Due
                                                        </th>
                                                        <th className='px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400'>
                                                            <span className='inline-flex items-center gap-1.5'>
                                                                Mark
                                                                <button
                                                                    type='button'
                                                                    onClick={() => {
                                                                        setMarkHelpOpen(
                                                                            true
                                                                        );
                                                                        trackAnalytics(
                                                                            "mark_help_opened"
                                                                        );
                                                                    }}
                                                                    className='rounded p-0.5 text-slate-500 transition-colors hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/50'
                                                                    aria-label='Mark input help'
                                                                >
                                                                    <svg
                                                                        className='h-3.5 w-3.5'
                                                                        fill='none'
                                                                        stroke='currentColor'
                                                                        viewBox='0 0 24 24'
                                                                        xmlns='http://www.w3.org/2000/svg'
                                                                    >
                                                                        <path
                                                                            strokeLinecap='round'
                                                                            strokeLinejoin='round'
                                                                            strokeWidth={
                                                                                2
                                                                            }
                                                                            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                                                        />
                                                                    </svg>
                                                                </button>
                                                            </span>
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className='divide-y divide-slate-900/60'>
                                                    {c.course.items.map(
                                                        (item, i) => {
                                                            const isPassFail =
                                                                item.weight ===
                                                                "pass/fail";

                                                            return (
                                                                <tr
                                                                    key={
                                                                        item.name +
                                                                        i
                                                                    }
                                                                    className='hover:bg-slate-900/70'
                                                                >
                                                                    <td className='px-4 py-3 align-middle'>
                                                                        <div className='flex items-center gap-2 max-w-xs flex-wrap'>
                                                                            <div className='text-sm font-semibold text-slate-100'>
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </div>
                                                                            {(item.isHurdle ||
                                                                                item.hurdleRequirements ||
                                                                                item.hurdleThreshold !=
                                                                                    null) && (
                                                                                <button
                                                                                    type='button'
                                                                                    onClick={() => {
                                                                                        setHurdlePopup(
                                                                                            {
                                                                                                courseIdx:
                                                                                                    idx,
                                                                                                itemIdx:
                                                                                                    i
                                                                                            }
                                                                                        );
                                                                                        trackAnalytics(
                                                                                            "hurdle_clicked"
                                                                                        );
                                                                                    }}
                                                                                    className='inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-400 transition-colors hover:border-amber-500/60 hover:bg-amber-500/20'
                                                                                    title='Hurdle requirement'
                                                                                >
                                                                                    Hurdle
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className='px-4 py-3 text-right align-middle'>
                                                                        {isPassFail ? (
                                                                            <span className='text-xs font-semibold text-amber-400'>
                                                                                Pass/fail
                                                                            </span>
                                                                        ) : (
                                                                            <span className='font-semibold text-slate-200'>
                                                                                {typeof item.weight ===
                                                                                "number"
                                                                                    ? item.weight.toFixed(
                                                                                          0
                                                                                      )
                                                                                    : "0"}

                                                                                %
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className='px-4 py-3 text-right align-middle text-slate-400 text-xs'>
                                                                        {item.dueDate ??
                                                                            "—"}
                                                                    </td>
                                                                    <td className='px-3 py-2 text-right align-middle'>
                                                                        {isPassFail ? (
                                                                            <span className='text-xs text-slate-400'>
                                                                                Pass
                                                                            </span>
                                                                        ) : (
                                                                            (() => {
                                                                                const handleMarkChange =
                                                                                    (
                                                                                        value: string
                                                                                    ) => {
                                                                                        const trimmed =
                                                                                            value.trim();
                                                                                        if (
                                                                                            trimmed ===
                                                                                            ""
                                                                                        ) {
                                                                                            updateMark(
                                                                                                idx,
                                                                                                i,
                                                                                                ""
                                                                                            );
                                                                                            return;
                                                                                        }
                                                                                        // Store what they typed (including "/XX")
                                                                                        updateMark(
                                                                                            idx,
                                                                                            i,
                                                                                            trimmed
                                                                                        );
                                                                                    };
                                                                                return (
                                                                                    <div className='flex flex-col items-end gap-1'>
                                                                                        <div className='relative'>
                                                                                            {!c
                                                                                                .marks[
                                                                                                i
                                                                                            ] &&
                                                                                            fillerMarks[
                                                                                                i
                                                                                            ] !=
                                                                                                null ? (
                                                                                                <input
                                                                                                    type='text'
                                                                                                    placeholder={fillerMarks[
                                                                                                        i
                                                                                                    ]!.toFixed(
                                                                                                        0
                                                                                                    )}
                                                                                                    value=''
                                                                                                    onChange={(
                                                                                                        e
                                                                                                    ) =>
                                                                                                        handleMarkChange(
                                                                                                            e
                                                                                                                .target
                                                                                                                .value
                                                                                                        )
                                                                                                    }
                                                                                                    className='w-28 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-1.5 pr-14 text-right text-sm font-semibold text-slate-50 outline-none backdrop-blur-sm placeholder:text-emerald-400/70 transition-all focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 focus:bg-slate-900/70'
                                                                                                />
                                                                                            ) : (
                                                                                                <input
                                                                                                    type='text'
                                                                                                    placeholder='e.g. 8/10 or 50'
                                                                                                    value={
                                                                                                        c
                                                                                                            .marks[
                                                                                                            i
                                                                                                        ] ??
                                                                                                        ""
                                                                                                    }
                                                                                                    onChange={(
                                                                                                        e
                                                                                                    ) =>
                                                                                                        handleMarkChange(
                                                                                                            e
                                                                                                                .target
                                                                                                                .value
                                                                                                        )
                                                                                                    }
                                                                                                    className='w-28 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-1.5 text-right text-sm font-semibold text-slate-50 outline-none backdrop-blur-sm placeholder:text-slate-600 transition-all focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 focus:bg-slate-900/70'
                                                                                                />
                                                                                            )}
                                                                                        </div>
                                                                                        {(() => {
                                                                                            // Check if mark is "/XX" format - show required "NN/XX (percentage%)" for goal in green
                                                                                            const slashOnly =
                                                                                                c.marks[
                                                                                                    i
                                                                                                ]
                                                                                                    ?.toString()
                                                                                                    .trim()
                                                                                                    .match(
                                                                                                        /^\/(\d+)$/
                                                                                                    );
                                                                                            if (
                                                                                                slashOnly
                                                                                            ) {
                                                                                                const denom =
                                                                                                    parseInt(
                                                                                                        slashOnly[1],
                                                                                                        10
                                                                                                    );
                                                                                                // Use required % on this assessment to reach goal (same as "Need X% on final")
                                                                                                const requiredPct =
                                                                                                    fillerMarks[
                                                                                                        i
                                                                                                    ];
                                                                                                if (
                                                                                                    requiredPct ==
                                                                                                    null
                                                                                                ) {
                                                                                                    return (
                                                                                                        <span className='text-xs font-semibold text-emerald-400'>
                                                                                                            —
                                                                                                        </span>
                                                                                                    );
                                                                                                }
                                                                                                // Smallest mark (nn) such that nn/denom >= requiredPct% (no rounding)
                                                                                                const nn =
                                                                                                    Math.min(
                                                                                                        denom,
                                                                                                        Math.ceil(
                                                                                                            (requiredPct *
                                                                                                                denom) /
                                                                                                                100
                                                                                                        )
                                                                                                    );
                                                                                                const actualPct =
                                                                                                    (nn /
                                                                                                        denom) *
                                                                                                    100;
                                                                                                return (
                                                                                                    <span className='text-xs font-semibold text-emerald-400'>
                                                                                                        {
                                                                                                            nn
                                                                                                        }

                                                                                                        /
                                                                                                        {
                                                                                                            denom
                                                                                                        }{" "}
                                                                                                        {actualPct >=
                                                                                                        100
                                                                                                            ? "100"
                                                                                                            : actualPct <=
                                                                                                                0
                                                                                                              ? "0"
                                                                                                              : actualPct.toFixed(
                                                                                                                    1
                                                                                                                )}

                                                                                                        %
                                                                                                    </span>
                                                                                                );
                                                                                            }

                                                                                            const displayMark =
                                                                                                c
                                                                                                    .marks[
                                                                                                    i
                                                                                                ] ??
                                                                                                fillerMarks[
                                                                                                    i
                                                                                                ];
                                                                                            const {
                                                                                                percentage
                                                                                            } =
                                                                                                formatMarkDisplay(
                                                                                                    displayMark
                                                                                                );
                                                                                            if (
                                                                                                percentage ==
                                                                                                null
                                                                                            )
                                                                                                return null;

                                                                                            return (
                                                                                                <span
                                                                                                    className={`text-xs font-semibold ${!c.marks[i] && fillerMarks[i] != null ? "text-emerald-400" : "text-slate-500"}`}
                                                                                                >
                                                                                                    {percentage.toFixed(
                                                                                                        0
                                                                                                    )}

                                                                                                    %
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
                                                        }
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </article>
                                );
                            })}
                        </section>
                    </>
                ) : (
                    <div className='mt-8 text-center text-sm text-slate-500'>
                        Select a semester card above or add a new one to start
                        tracking courses.
                    </div>
                )}

                <footer className='mt-12 border-t border-slate-800 pt-6 text-center'>
                    <p className='text-xs text-slate-500 mb-3'>
                        Not affiliated with UQ. All data is scraped from UQ
                        course profiles. Please verify information on the
                        official UQ website. This tool is for convenience only
                        and may contain errors. UQ Grades is not responsible for
                        your grades, missed hurdles and deadlines, or that
                        Netflix binge two days before the final.
                    </p>
                    <p className='text-xs text-slate-500'>
                        <a
                            href='mailto:vincemlapore@gmail.com?subject=UQ%20Grades%20(uqgrades.com)'
                            className='text-slate-400 hover:text-slate-300 underline underline-offset-2'
                        >
                            Report bugs, compliments, or feature ideas
                        </a>
                        . Made with love by{" "}
                        <a
                            href='https://vincelapore.com'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-slate-400 hover:text-slate-300 underline underline-offset-2'
                        >
                            me
                        </a>
                    </p>
                    <p className='text-xs text-slate-500 mt-2'></p>
                </footer>
            </main>

            {/* Mark help popup */}
            {markHelpOpen && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
                    onClick={() => setMarkHelpOpen(false)}
                >
                    <div
                        className='relative w-full max-w-xl rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 p-6 shadow-2xl backdrop-blur-xl'
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setMarkHelpOpen(false)}
                            className='absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-200'
                            aria-label='Close'
                        >
                            <svg
                                className='h-5 w-5'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M6 18L18 6M6 6l12 12'
                                />
                            </svg>
                        </button>

                        <div className='space-y-4'>
                            <div>
                                <h2 className='text-xl font-bold tracking-tight text-slate-50'>
                                    How to enter marks
                                </h2>
                            </div>

                            <div className='space-y-3 text-sm text-slate-200'>
                                <div>
                                    <p className='font-semibold text-slate-100'>
                                        1. Enter a percentage
                                    </p>
                                    <p className='mt-1 text-slate-300'>
                                        Type a number like{" "}
                                        <span className='font-mono'>50</span>{" "}
                                        for{" "}
                                        <span className='font-mono'>50%</span>.
                                    </p>
                                </div>

                                <div>
                                    <p className='font-semibold text-slate-100'>
                                        2. Enter marks out of a total
                                    </p>
                                    <p className='mt-1 text-slate-300'>
                                        Use a fraction like{" "}
                                        <span className='font-mono'>8/10</span>{" "}
                                        or{" "}
                                        <span className='font-mono'>24/30</span>
                                        .
                                    </p>
                                </div>

                                <div>
                                    <p className='font-semibold text-slate-100'>
                                        3. See required marks for your goal
                                        grade
                                    </p>
                                    <p className='mt-1 text-slate-300'>
                                        Type{" "}
                                        <span className='font-mono'>/50</span>{" "}
                                        in a mark field to see how many marks
                                        out of 50 you need for your goal grade.
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
                        (_, i) => calendarEventSelection[i]
                    );

                    return (
                        <div
                            className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
                            onClick={() => setCalendarPopup(null)}
                        >
                            <div
                                className='relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 p-8 shadow-2xl backdrop-blur-xl'
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => setCalendarPopup(null)}
                                    className='absolute right-6 top-6 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-200'
                                    aria-label='Close'
                                >
                                    <svg
                                        className='h-5 w-5'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M6 18L18 6M6 6l12 12'
                                        />
                                    </svg>
                                </button>

                                <div className='space-y-6'>
                                    <div>
                                        <h2 className='text-2xl font-bold tracking-tight text-slate-50'>
                                            Calendar Events
                                        </h2>
                                        <p className='mt-1.5 text-sm font-medium text-slate-400'>
                                            {course.course.courseCode} -{" "}
                                            {allEvents.length} event
                                            {allEvents.length !== 1 ? "s" : ""}
                                            {selectedEvents.length !==
                                                allEvents.length && (
                                                <span className='text-slate-500'>
                                                    {" "}
                                                    ({
                                                        selectedEvents.length
                                                    }{" "}
                                                    selected)
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {allEvents.length === 0 ? (
                                        <div className='rounded-xl border border-slate-800/50 bg-slate-900/30 p-6 text-center'>
                                            <p className='text-sm text-slate-400'>
                                                No due dates found for this
                                                course.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className='flex justify-end'>
                                                {calendarEventSelection.every(
                                                    (v) => v
                                                ) ? (
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            setCalendarEventSelection(
                                                                allEvents.map(
                                                                    () => false
                                                                )
                                                            )
                                                        }
                                                        className='text-sm text-slate-400 hover:text-slate-200'
                                                    >
                                                        Deselect all
                                                    </button>
                                                ) : (
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            setCalendarEventSelection(
                                                                allEvents.map(
                                                                    () => true
                                                                )
                                                            )
                                                        }
                                                        className='text-sm text-slate-400 hover:text-slate-200'
                                                    >
                                                        Select all
                                                    </button>
                                                )}
                                            </div>
                                            <div className='space-y-3'>
                                                {allEvents.map(
                                                    (event, index) => (
                                                        <label
                                                            key={index}
                                                            className='flex cursor-pointer items-center gap-4 rounded-xl border border-slate-800/50 bg-slate-900/30 p-4 transition-all hover:bg-slate-900/50 has-[:checked]:border-sky-500/50 has-[:checked]:bg-sky-500/10 has-[:checked]:shadow-[0_0_0_1px_rgba(14,165,233,0.15)]'
                                                        >
                                                            <div className='min-w-0 flex-1'>
                                                                <h3 className='text-base font-semibold text-slate-50'>
                                                                    {
                                                                        event.title
                                                                    }
                                                                </h3>
                                                                <div className='mt-2 space-y-1 text-sm text-slate-400'>
                                                                    <div className='flex items-center gap-2'>
                                                                        <svg
                                                                            className='h-4 w-4 shrink-0'
                                                                            fill='none'
                                                                            stroke='currentColor'
                                                                            viewBox='0 0 24 24'
                                                                        >
                                                                            <path
                                                                                strokeLinecap='round'
                                                                                strokeLinejoin='round'
                                                                                strokeWidth={
                                                                                    2
                                                                                }
                                                                                d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                                                                            />
                                                                        </svg>
                                                                        <span>
                                                                            {formatEventDate(
                                                                                event.startDate
                                                                            )}
                                                                            {event.endDate.getTime() !==
                                                                                event.startDate.getTime() && (
                                                                                <span className='ml-1'>
                                                                                    -{" "}
                                                                                    {formatEventDate(
                                                                                        event.endDate
                                                                                    )}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    {event.description && (
                                                                        <p className='text-xs text-slate-500 mt-1'>
                                                                            {
                                                                                event.description
                                                                            }
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <input
                                                                type='checkbox'
                                                                checked={
                                                                    calendarEventSelection[
                                                                        index
                                                                    ] ?? true
                                                                }
                                                                onChange={(e) =>
                                                                    setCalendarEventSelection(
                                                                        (
                                                                            prev
                                                                        ) => {
                                                                            const next =
                                                                                [
                                                                                    ...prev
                                                                                ];
                                                                            next[
                                                                                index
                                                                            ] =
                                                                                e.target.checked;
                                                                            return next;
                                                                        }
                                                                    )
                                                                }
                                                                className='h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-2 focus:ring-sky-500/50'
                                                            />
                                                        </label>
                                                    )
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {allEvents.length > 0 && (
                                        <div className='flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800/50'>
                                            {selectedEvents.length === 0 && (
                                                <p className='text-sm text-amber-400'>
                                                    Select at least one event to
                                                    export.
                                                </p>
                                            )}
                                            <button
                                                disabled={
                                                    selectedEvents.length === 0
                                                }
                                                onClick={() => {
                                                    const icalContent =
                                                        generateICal(
                                                            selectedEvents,
                                                            course.course
                                                                .courseCode
                                                        );

                                                    const blob = new Blob(
                                                        [icalContent],
                                                        {
                                                            type: "text/calendar;charset=utf-8"
                                                        }
                                                    );
                                                    const url =
                                                        URL.createObjectURL(
                                                            blob
                                                        );
                                                    const link =
                                                        document.createElement(
                                                            "a"
                                                        );
                                                    link.href = url;
                                                    link.download = `${course.course.courseCode}-calendar.ics`;
                                                    document.body.appendChild(
                                                        link
                                                    );
                                                    link.click();
                                                    document.body.removeChild(
                                                        link
                                                    );
                                                    URL.revokeObjectURL(url);
                                                    trackAnalytics(
                                                        "calendar_export"
                                                    );
                                                }}
                                                className='inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 backdrop-blur-sm transition-all hover:border-emerald-500 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-emerald-500/50 disabled:hover:bg-emerald-500/10'
                                            >
                                                <svg
                                                    className='h-4 w-4'
                                                    fill='none'
                                                    stroke='currentColor'
                                                    viewBox='0 0 24 24'
                                                >
                                                    <path
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                        strokeWidth={2}
                                                        d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                                                    />
                                                </svg>
                                                Export to Calendar
                                                {selectedEvents.length > 0 &&
                                                    selectedEvents.length !==
                                                        allEvents.length && (
                                                        <span className='text-emerald-400/80'>
                                                            (
                                                            {
                                                                selectedEvents.length
                                                            }
                                                            )
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

            {/* Hurdle info popup */}
            {hurdlePopup != null &&
                (() => {
                    const course = state.courses[hurdlePopup.courseIdx];
                    if (!course) return null;
                    const item = course.course.items[hurdlePopup.itemIdx];
                    if (!item) return null;
                    const hurdleText =
                        item.hurdleRequirements ||
                        course.course.hurdleInformation ||
                        null;
                    const threshold =
                        item.hurdleThreshold != null
                            ? `Pass threshold: ${item.hurdleThreshold}%`
                            : null;

                    return (
                        <div
                            className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
                            onClick={() => setHurdlePopup(null)}
                        >
                            <div
                                className='relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 p-6 shadow-2xl backdrop-blur-xl'
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => setHurdlePopup(null)}
                                    className='absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-200'
                                    aria-label='Close'
                                >
                                    <svg
                                        className='h-5 w-5'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M6 18L18 6M6 6l12 12'
                                        />
                                    </svg>
                                </button>
                                <div className='space-y-4 pr-8'>
                                    <div>
                                        <span className='inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400'>
                                            Hurdle
                                        </span>
                                        <h2 className='mt-2 text-lg font-bold tracking-tight text-slate-50'>
                                            {item.name}
                                        </h2>
                                        <p className='text-sm text-slate-400'>
                                            {course.course.courseCode}
                                        </p>
                                    </div>
                                    {threshold && (
                                        <p className='text-sm font-medium text-amber-300/90'>
                                            {threshold}
                                        </p>
                                    )}
                                    {hurdleText && (
                                        <div className='rounded-xl border border-slate-800/50 bg-slate-900/30 p-4'>
                                            <p className='whitespace-pre-wrap text-sm text-slate-300'>
                                                {hurdleText}
                                            </p>
                                        </div>
                                    )}
                                    {!hurdleText && !threshold && (
                                        <p className='text-sm text-slate-500'>
                                            No hurdle details available for this
                                            item.
                                        </p>
                                    )}
                                    {course.course.courseProfileUrl && (
                                        <a
                                            href={`${course.course.courseProfileUrl}#assessment`}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='inline-flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-950/50 px-4 py-2 text-sm font-medium text-sky-400 transition-all hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300'
                                        >
                                            <svg
                                                className='h-4 w-4'
                                                fill='none'
                                                stroke='currentColor'
                                                viewBox='0 0 24 24'
                                            >
                                                <path
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                    strokeWidth={2}
                                                    d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
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
        <Suspense
            fallback={
                <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-400'>
                    Loading...
                </div>
            }
        >
            <HomeContent />
        </Suspense>
    );
}
